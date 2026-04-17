import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { db as liveDb, type Database } from "@corex/db";
import { userTrainingPreference } from "@corex/db/schema/training-settings";
import {
  weeklyPlanRenewalJobAttempt,
  weeklyPlanRenewalJobRun,
} from "@corex/db/schema/weekly-planning";
import { env } from "@corex/env/server";

import { getLocalDateKey } from "../activity-history/activity-calendar";
import { sanitizeFailureSummary } from "../diagnostics/redaction";
import { createLivePlanAdherenceService } from "../plan-adherence/live";
import { createLivePlanningDataService } from "../planning-data/live";
import { createLiveTrainingSettingsService } from "../training-settings/live";
import type { PlannerModelPort } from "./model";
import { createOpenAiPlannerModel } from "./openai-model";
import { createWeeklyPlanningRepository } from "./repository";
import { createWeeklyPlanningService } from "./service";
import { addDays } from "./domain";

type Clock = {
  now: () => Date;
};

type JobRunStatus = "success" | "partial_failure" | "failure";
type JobAttemptStatus =
  | "generated"
  | "existing_draft"
  | "skipped_missing_settings"
  | "skipped_no_finalized_plan"
  | "skipped_not_due"
  | "skipped_no_local_history"
  | "failed";

type AttemptSummary = {
  status: JobAttemptStatus;
};

type EligibleRenewalUser = {
  userId: string;
  timezone: string;
};

export type ScheduledWeeklyPlanRenewalRunResult = {
  runId: string;
  status: JobRunStatus;
  startedAt: Date;
  completedAt: Date;
  generatedCount: number;
  existingCount: number;
  skippedCount: number;
  failedCount: number;
};

type ScheduledWeeklyPlanRenewalRepository = ReturnType<
  typeof createScheduledWeeklyPlanRenewalRepository
>;

function summarizeAttempts(attempts: AttemptSummary[]) {
  const summary = {
    generatedCount: 0,
    existingCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };

  for (const attempt of attempts) {
    if (attempt.status === "generated") {
      summary.generatedCount += 1;
      continue;
    }

    if (attempt.status === "existing_draft") {
      summary.existingCount += 1;
      continue;
    }

    if (attempt.status === "failed") {
      summary.failedCount += 1;
      continue;
    }

    summary.skippedCount += 1;
  }

  return {
    ...summary,
    status: summary.failedCount > 0 ? "partial_failure" : "success",
  } satisfies Omit<
    ScheduledWeeklyPlanRenewalRunResult,
    "runId" | "startedAt" | "completedAt"
  >;
}

function createScheduledWeeklyPlanRenewalRepository(database: Database) {
  return {
    createRun(input: { id: string; startedAt: Date }) {
      return Effect.tryPromise({
        try: async () => {
          await database.insert(weeklyPlanRenewalJobRun).values({
            id: input.id,
            status: "success",
            startedAt: input.startedAt,
            completedAt: null,
          });
        },
        catch: (cause) =>
          new Error(
            `Failed to create weekly plan renewal job run: ${cause instanceof Error ? cause.message : String(cause)}`,
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
            .update(weeklyPlanRenewalJobRun)
            .set({
              status: input.status,
              completedAt: input.completedAt,
              generatedCount: input.generatedCount,
              existingCount: input.existingCount,
              skippedCount: input.skippedCount,
              failedCount: input.failedCount,
              updatedAt: input.completedAt,
            })
            .where(eq(weeklyPlanRenewalJobRun.id, input.id));
        },
        catch: (cause) =>
          new Error(
            `Failed to complete weekly plan renewal job run: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    listOptedInUsers(input: { batchSize?: number }) {
      return Effect.tryPromise({
        try: async () => {
          const query = database
            .select({
              userId: userTrainingPreference.userId,
              timezone: userTrainingPreference.timezone,
            })
            .from(userTrainingPreference)
            .where(
              eq(
                userTrainingPreference.automaticWeeklyPlanRenewalEnabled,
                true,
              ),
            )
            .orderBy(userTrainingPreference.userId);

          const rows =
            input.batchSize && input.batchSize > 0
              ? await query.limit(input.batchSize)
              : await query;

          return rows satisfies EligibleRenewalUser[];
        },
        catch: (cause) =>
          new Error(
            `Failed to list users eligible for weekly plan renewal: ${cause instanceof Error ? cause.message : String(cause)}`,
          ),
      });
    },
    recordAttempt(input: {
      id: string;
      runId: string;
      userId: string;
      timezone: string;
      sourceWeeklyPlanId: string | null;
      generatedWeeklyPlanId: string | null;
      targetStartDate: string | null;
      targetEndDate: string | null;
      status: JobAttemptStatus;
      failureSummary: string | null;
    }) {
      return Effect.tryPromise({
        try: async () => {
          await database.insert(weeklyPlanRenewalJobAttempt).values(input);
        },
        catch: (cause) =>
          new Error(
            `Failed to record weekly plan renewal job attempt: ${cause instanceof Error ? cause.message : String(cause)}`,
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
  repo: ScheduledWeeklyPlanRenewalRepository,
  idGenerator: () => string,
  input: {
    runId: string;
    userId: string;
    timezone: string;
    sourceWeeklyPlanId?: string | null;
    generatedWeeklyPlanId?: string | null;
    targetStartDate?: string | null;
    targetEndDate?: string | null;
    status: JobAttemptStatus;
    failureSummary?: string | null;
  },
) {
  return repo.recordAttempt({
    id: idGenerator(),
    runId: input.runId,
    userId: input.userId,
    timezone: input.timezone,
    sourceWeeklyPlanId: input.sourceWeeklyPlanId ?? null,
    generatedWeeklyPlanId: input.generatedWeeklyPlanId ?? null,
    targetStartDate: input.targetStartDate ?? null,
    targetEndDate: input.targetEndDate ?? null,
    status: input.status,
    failureSummary: input.failureSummary ?? null,
  });
}

function processEligibleUser(input: {
  runId: string;
  user: EligibleRenewalUser;
  now: Date;
  repo: ScheduledWeeklyPlanRenewalRepository;
  weeklyPlanningRepo: ReturnType<typeof createWeeklyPlanningRepository>;
  trainingSettingsService: ReturnType<typeof createLiveTrainingSettingsService>;
  planningDataService: ReturnType<typeof createLivePlanningDataService>;
  weeklyPlanningService: ReturnType<typeof createWeeklyPlanningService>;
  idGenerator: () => string;
}): Effect.Effect<AttemptSummary, unknown> {
  return Effect.gen(function* () {
    const settings = yield* input.trainingSettingsService.getForUser(
      input.user.userId,
    );

    if (settings.status !== "complete" || !settings.availability) {
      yield* recordAttempt(input.repo, input.idGenerator, {
        runId: input.runId,
        userId: input.user.userId,
        timezone: input.user.timezone,
        status: "skipped_missing_settings",
      });
      return { status: "skipped_missing_settings" as const };
    }

    const latestPlan = yield* input.weeklyPlanningRepo.getLatestPlan(
      input.user.userId,
    );
    const sourcePlan =
      latestPlan?.status === "finalized"
        ? latestPlan
        : yield* input.weeklyPlanningRepo.getLatestFinalizedPlan(
            input.user.userId,
          );
    const targetStartDate = sourcePlan ? addDays(sourcePlan.endDate, 1) : null;
    const targetEndDate = targetStartDate ? addDays(targetStartDate, 6) : null;

    if (!sourcePlan) {
      yield* recordAttempt(input.repo, input.idGenerator, {
        runId: input.runId,
        userId: input.user.userId,
        timezone: input.user.timezone,
        sourceWeeklyPlanId: latestPlan?.id,
        targetStartDate,
        targetEndDate,
        status: "skipped_no_finalized_plan",
      });
      return { status: "skipped_no_finalized_plan" as const };
    }

    const existingDraft = yield* input.weeklyPlanningRepo.getDraftForStartDate(
      input.user.userId,
      targetStartDate!,
    );

    if (existingDraft) {
      yield* recordAttempt(input.repo, input.idGenerator, {
        runId: input.runId,
        userId: input.user.userId,
        timezone: input.user.timezone,
        sourceWeeklyPlanId: sourcePlan.id,
        generatedWeeklyPlanId: existingDraft.id,
        targetStartDate,
        targetEndDate,
        status: "existing_draft",
      });
      return { status: "existing_draft" as const };
    }

    if (latestPlan?.status !== "finalized") {
      yield* recordAttempt(input.repo, input.idGenerator, {
        runId: input.runId,
        userId: input.user.userId,
        timezone: input.user.timezone,
        sourceWeeklyPlanId: latestPlan?.id ?? sourcePlan.id,
        targetStartDate,
        targetEndDate,
        status: "skipped_no_finalized_plan",
      });
      return { status: "skipped_no_finalized_plan" as const };
    }

    if (getLocalDateKey(input.now, input.user.timezone) < sourcePlan.endDate) {
      yield* recordAttempt(input.repo, input.idGenerator, {
        runId: input.runId,
        userId: input.user.userId,
        timezone: input.user.timezone,
        sourceWeeklyPlanId: sourcePlan.id,
        targetStartDate,
        targetEndDate,
        status: "skipped_not_due",
      });
      return { status: "skipped_not_due" as const };
    }

    const historyQuality = yield* input.planningDataService.getHistoryQuality(
      input.user.userId,
    );

    if (!historyQuality.hasAnyHistory) {
      yield* recordAttempt(input.repo, input.idGenerator, {
        runId: input.runId,
        userId: input.user.userId,
        timezone: input.user.timezone,
        sourceWeeklyPlanId: sourcePlan.id,
        targetStartDate,
        targetEndDate,
        status: "skipped_no_local_history",
      });
      return { status: "skipped_no_local_history" as const };
    }

    const draft =
      yield* input.weeklyPlanningService.generateNextWeekFromLatestFinalized(
        input.user.userId,
      );

    yield* recordAttempt(input.repo, input.idGenerator, {
      runId: input.runId,
      userId: input.user.userId,
      timezone: input.user.timezone,
      sourceWeeklyPlanId: sourcePlan.id,
      generatedWeeklyPlanId: draft.id,
      targetStartDate,
      targetEndDate,
      status: "generated",
    });

    return { status: "generated" as const };
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* recordAttempt(input.repo, input.idGenerator, {
          runId: input.runId,
          userId: input.user.userId,
          timezone: input.user.timezone,
          status: "failed",
          failureSummary: toFailureSummary(error),
        });
        return { status: "failed" as const };
      }),
    ),
  );
}

export function runScheduledWeeklyPlanRenewal(
  options: {
    db?: Database;
    now?: Date;
    batchSize?: number;
    clock?: Clock;
    model?: PlannerModelPort;
    idGenerator?: () => string;
  } = {},
): Effect.Effect<ScheduledWeeklyPlanRenewalRunResult, unknown> {
  const database = options.db ?? liveDb;
  const now = options.now ?? options.clock?.now() ?? new Date();
  const idGenerator = options.idGenerator ?? randomUUID;
  const model =
    options.model ??
    createOpenAiPlannerModel({
      apiKey: env.OPENAI_API_KEY,
      model: env.PLANNER_OPENAI_MODEL,
    });
  const repo = createScheduledWeeklyPlanRenewalRepository(database);
  const weeklyPlanningRepo = createWeeklyPlanningRepository(database);
  const trainingSettingsService = createLiveTrainingSettingsService({
    db: database,
  });
  const planningDataService = createLivePlanningDataService({ db: database });
  const weeklyPlanningService = createWeeklyPlanningService({
    trainingSettingsService,
    planningDataService,
    repo: weeklyPlanningRepo,
    model,
    planAdherenceService: createLivePlanAdherenceService({ db: database }),
    clock: { now: () => now },
    idGenerator,
  });
  const runId = idGenerator();

  return Effect.gen(function* () {
    yield* repo.createRun({ id: runId, startedAt: now });
    const outcome = yield* Effect.either(
      Effect.gen(function* () {
        const users = yield* repo.listOptedInUsers({
          batchSize: options.batchSize,
        });
        const attempts: AttemptSummary[] = [];

        for (const user of users) {
          const attempt = yield* processEligibleUser({
            runId,
            user,
            now,
            repo,
            weeklyPlanningRepo,
            trainingSettingsService,
            planningDataService,
            weeklyPlanningService,
            idGenerator,
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

export function runScheduledWeeklyPlanRenewalPromise(
  options: Parameters<typeof runScheduledWeeklyPlanRenewal>[0] = {},
) {
  return Effect.runPromise(runScheduledWeeklyPlanRenewal(options));
}
