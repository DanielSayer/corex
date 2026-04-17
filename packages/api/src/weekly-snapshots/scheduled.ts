import { randomUUID } from "node:crypto";

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { db as liveDb } from "@corex/db";
import { importedActivity } from "@corex/db/schema/intervals-sync";
import {
  intervalsCredential,
  trainingAvailability,
  userTrainingPreference,
} from "@corex/db/schema/training-settings";
import {
  weeklySnapshotJobAttempt,
  weeklySnapshotJobRun,
} from "@corex/db/schema/weekly-snapshots";

import {
  addDaysToDateKey,
  getLocalWeekRange,
  localDateKeyToUtcStart,
} from "../goal-progress/timezones";
import { sanitizeFailureSummary } from "../diagnostics/redaction";
import { createLiveWeeklySnapshotService } from "./live";
import { createWeeklySnapshotRepository } from "./repository";

type Clock = {
  now: () => Date;
};

type EligibleSnapshotUser = {
  userId: string;
  timezone: string;
};

type ScheduledWeekRanges = {
  snapshotWeekStart: Date;
  snapshotWeekEnd: Date;
  comparisonWeekStart: Date;
  comparisonWeekEnd: Date;
};

type JobRunStatus = "success" | "partial_failure" | "failure";
type JobAttemptStatus =
  | "generated"
  | "existing"
  | "skipped_no_relevant_runs"
  | "failed";

type AttemptSummary = {
  status: JobAttemptStatus;
};

export type ScheduledWeeklySnapshotRunResult = {
  runId: string;
  status: JobRunStatus;
  startedAt: Date;
  completedAt: Date;
  generatedCount: number;
  existingCount: number;
  skippedCount: number;
  failedCount: number;
};

type ScheduledWeeklySnapshotRepository = ReturnType<
  typeof createScheduledWeeklySnapshotRepository
>;

function buildScheduledWeekRanges(
  now: Date,
  timezone: string,
): ScheduledWeekRanges {
  const currentWeek = getLocalWeekRange(now, timezone);
  const snapshotWeekStartKey = addDaysToDateKey(currentWeek.startKey, -7);
  const comparisonWeekStartKey = addDaysToDateKey(currentWeek.startKey, -14);

  return {
    snapshotWeekStart: localDateKeyToUtcStart(snapshotWeekStartKey, timezone),
    snapshotWeekEnd: localDateKeyToUtcStart(currentWeek.startKey, timezone),
    comparisonWeekStart: localDateKeyToUtcStart(
      comparisonWeekStartKey,
      timezone,
    ),
    comparisonWeekEnd: localDateKeyToUtcStart(snapshotWeekStartKey, timezone),
  };
}

function summarizeAttempts(attempts: AttemptSummary[]) {
  const summary = {
    generatedCount: 0,
    existingCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };

  for (const attempt of attempts) {
    switch (attempt.status) {
      case "generated":
        summary.generatedCount += 1;
        break;
      case "existing":
        summary.existingCount += 1;
        break;
      case "skipped_no_relevant_runs":
        summary.skippedCount += 1;
        break;
      case "failed":
        summary.failedCount += 1;
        break;
    }
  }

  return {
    ...summary,
    status: summary.failedCount > 0 ? "partial_failure" : "success",
  } satisfies Omit<
    ScheduledWeeklySnapshotRunResult,
    "runId" | "startedAt" | "completedAt"
  >;
}

function createScheduledWeeklySnapshotRepository(database: Database) {
  return {
    createRun(input: { id: string; startedAt: Date }) {
      return Effect.tryPromise({
        try: async () => {
          await database.insert(weeklySnapshotJobRun).values({
            id: input.id,
            status: "success",
            startedAt: input.startedAt,
            completedAt: null,
          });
        },
        catch: (cause) =>
          new Error(
            `Failed to create weekly snapshot job run: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    completeRun(input: {
      id: string;
      completedAt: Date;
      status: JobRunStatus;
      generatedCount: number;
      existingCount: number;
      skippedCount: number;
      failedCount: number;
    }) {
      return Effect.tryPromise({
        try: async () => {
          await database
            .update(weeklySnapshotJobRun)
            .set({
              status: input.status,
              completedAt: input.completedAt,
              generatedCount: input.generatedCount,
              existingCount: input.existingCount,
              skippedCount: input.skippedCount,
              failedCount: input.failedCount,
              updatedAt: input.completedAt,
            })
            .where(eq(weeklySnapshotJobRun.id, input.id));
        },
        catch: (cause) =>
          new Error(
            `Failed to complete weekly snapshot job run: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    listEligibleUsers(input: { batchSize?: number }) {
      return Effect.tryPromise({
        try: async () => {
          const query = database
            .select({
              userId: userTrainingPreference.userId,
              timezone: userTrainingPreference.timezone,
              availabilityCount: sql<number>`count(${trainingAvailability.dayOfWeek})`,
            })
            .from(userTrainingPreference)
            .innerJoin(
              intervalsCredential,
              eq(intervalsCredential.userId, userTrainingPreference.userId),
            )
            .innerJoin(
              trainingAvailability,
              eq(trainingAvailability.userId, userTrainingPreference.userId),
            )
            .groupBy(
              userTrainingPreference.userId,
              userTrainingPreference.timezone,
            )
            .orderBy(userTrainingPreference.userId);

          const rows =
            input.batchSize && input.batchSize > 0
              ? await query.limit(input.batchSize)
              : await query;

          return rows
            .filter((row) => Number(row.availabilityCount) === 7)
            .map((row) => ({
              userId: row.userId,
              timezone: row.timezone,
            })) satisfies EligibleSnapshotUser[];
        },
        catch: (cause) =>
          new Error(
            `Failed to list users eligible for weekly snapshots: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    hasRelevantRuns(input: {
      userId: string;
      rangeStart: Date;
      rangeEnd: Date;
    }) {
      return Effect.tryPromise({
        try: async () => {
          const [row] = await database
            .select({ runCount: sql<number>`count(*)` })
            .from(importedActivity)
            .where(
              and(
                eq(importedActivity.userId, input.userId),
                gte(importedActivity.startAt, input.rangeStart),
                lt(importedActivity.startAt, input.rangeEnd),
              ),
            );

          return Number(row?.runCount ?? 0) > 0;
        },
        catch: (cause) =>
          new Error(
            `Failed to check weekly snapshot run history: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    recordAttempt(input: {
      id: string;
      runId: string;
      userId: string;
      timezone: string;
      weekStart: Date;
      weekEnd: Date;
      status: JobAttemptStatus;
      snapshotId: string | null;
      failureSummary: string | null;
    }) {
      return Effect.tryPromise({
        try: async () => {
          await database.insert(weeklySnapshotJobAttempt).values({
            id: input.id,
            runId: input.runId,
            userId: input.userId,
            timezone: input.timezone,
            weekStart: input.weekStart,
            weekEnd: input.weekEnd,
            status: input.status,
            snapshotId: input.snapshotId,
            failureSummary: input.failureSummary,
          });
        },
        catch: (cause) =>
          new Error(
            `Failed to record weekly snapshot job attempt: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
  };
}

function toFailureSummary(error: unknown) {
  return sanitizeFailureSummary(
    error instanceof Error ? error.message : String(error),
  );
}

function recordAttempt(
  repo: ScheduledWeeklySnapshotRepository,
  input: {
    runId: string;
    userId: string;
    timezone: string;
    ranges: ScheduledWeekRanges;
    status: JobAttemptStatus;
    snapshotId?: string | null;
    failureSummary?: string | null;
  },
) {
  return repo.recordAttempt({
    id: randomUUID(),
    runId: input.runId,
    userId: input.userId,
    timezone: input.timezone,
    weekStart: input.ranges.snapshotWeekStart,
    weekEnd: input.ranges.snapshotWeekEnd,
    status: input.status,
    snapshotId: input.snapshotId ?? null,
    failureSummary: input.failureSummary ?? null,
  });
}

function processEligibleUser(input: {
  runId: string;
  user: EligibleSnapshotUser;
  now: Date;
  repo: ScheduledWeeklySnapshotRepository;
  snapshotRepo: ReturnType<typeof createWeeklySnapshotRepository>;
  snapshotService: ReturnType<typeof createLiveWeeklySnapshotService>;
}): Effect.Effect<AttemptSummary, unknown> {
  const ranges = buildScheduledWeekRanges(input.now, input.user.timezone);

  return Effect.gen(function* () {
    const existing = yield* input.snapshotRepo.findByUserAndWeek({
      userId: input.user.userId,
      timezone: input.user.timezone,
      weekStart: ranges.snapshotWeekStart,
      weekEnd: ranges.snapshotWeekEnd,
    });

    if (existing) {
      yield* recordAttempt(input.repo, {
        runId: input.runId,
        userId: input.user.userId,
        timezone: input.user.timezone,
        ranges,
        status: "existing",
        snapshotId: existing.id,
      });
      return { status: "existing" as const };
    }

    const hasRelevantRuns = yield* input.repo.hasRelevantRuns({
      userId: input.user.userId,
      rangeStart: ranges.comparisonWeekStart,
      rangeEnd: ranges.snapshotWeekEnd,
    });

    if (!hasRelevantRuns) {
      yield* recordAttempt(input.repo, {
        runId: input.runId,
        userId: input.user.userId,
        timezone: input.user.timezone,
        ranges,
        status: "skipped_no_relevant_runs",
      });
      return { status: "skipped_no_relevant_runs" as const };
    }

    const created =
      yield* input.snapshotService.createWeeklySnapshotForUserIfMissing(
        input.user.userId,
      );
    const status: JobAttemptStatus = created.created ? "generated" : "existing";
    yield* recordAttempt(input.repo, {
      runId: input.runId,
      userId: input.user.userId,
      timezone: input.user.timezone,
      ranges,
      status,
      snapshotId: created.snapshot.id,
    });

    return { status };
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* recordAttempt(input.repo, {
          runId: input.runId,
          userId: input.user.userId,
          timezone: input.user.timezone,
          ranges,
          status: "failed",
          failureSummary: toFailureSummary(error),
        });
        return { status: "failed" as const };
      }),
    ),
  );
}

export function runScheduledWeeklySnapshotGeneration(
  options: {
    db?: Database;
    now?: Date;
    batchSize?: number;
    clock?: Clock;
  } = {},
): Effect.Effect<ScheduledWeeklySnapshotRunResult, unknown> {
  const database = options.db ?? liveDb;
  const now = options.now ?? options.clock?.now() ?? new Date();
  const repo = createScheduledWeeklySnapshotRepository(database);
  const snapshotRepo = createWeeklySnapshotRepository(database);
  const snapshotService = createLiveWeeklySnapshotService({
    db: database,
    clock: { now: () => now },
  });
  const runId = randomUUID();

  return Effect.gen(function* () {
    yield* repo.createRun({ id: runId, startedAt: now });
    const outcome = yield* Effect.either(
      Effect.gen(function* () {
        const users = yield* repo.listEligibleUsers({
          batchSize: options.batchSize,
        });
        const attempts: AttemptSummary[] = [];

        for (const user of users) {
          const attempt = yield* processEligibleUser({
            runId,
            user,
            now,
            repo,
            snapshotRepo,
            snapshotService,
          });
          attempts.push(attempt);
        }

        const completedAt = options.clock?.now() ?? new Date();
        const summary = summarizeAttempts(attempts);
        yield* repo.completeRun({
          id: runId,
          completedAt,
          ...summary,
        });

        return {
          runId,
          startedAt: now,
          completedAt,
          ...summary,
        };
      }),
    );

    if (outcome._tag === "Right") {
      return outcome.right;
    }

    const completedAt = options.clock?.now() ?? new Date();
    yield* repo.completeRun({
      id: runId,
      completedAt,
      status: "failure",
      generatedCount: 0,
      existingCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });

    return yield* Effect.fail(outcome.left);
  });
}

export function runScheduledWeeklySnapshotGenerationPromise(
  options: Parameters<typeof runScheduledWeeklySnapshotGeneration>[0] = {},
) {
  return Effect.runPromise(runScheduledWeeklySnapshotGeneration(options));
}
