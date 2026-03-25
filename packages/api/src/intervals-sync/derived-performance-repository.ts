import { and, asc, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  importedActivity,
  runBestEffort,
  runProcessingWarning,
  userAllTimePr,
  userMonthlyBest,
} from "@corex/db/schema/intervals-sync";

import type {
  PrCandidate,
  RunBestEffortInput,
  RunProcessingWarning,
} from "./derived-performance";
import {
  normalizeMonthStart,
  selectAllTimePr,
  selectMonthlyPrs,
} from "./derived-performance";
import type { IntervalsActivityStream } from "./schemas";
import { SyncPersistenceFailure } from "./errors";

export type ImportedRunForDerivedPerformance = {
  userId: string;
  upstreamActivityId: string;
  normalizedActivityType: string;
  startAt: Date;
  movingTimeSeconds: number;
  distanceStream: IntervalsActivityStream | null;
};

export type DerivedPerformanceWriteSummary = {
  effortCount: number;
  warningCount: number;
  allTimePrCount: number;
  monthlyBestCount: number;
};

export type DerivedPerformanceRepository = {
  replaceRunEfforts: (input: {
    userId: string;
    upstreamActivityId: string;
    startAt: Date;
    efforts: RunBestEffortInput[];
  }) => Effect.Effect<DerivedPerformanceWriteSummary, SyncPersistenceFailure>;
  replaceRunWarnings: (input: {
    userId: string;
    upstreamActivityId: string;
    warnings: RunProcessingWarning[];
  }) => Effect.Effect<DerivedPerformanceWriteSummary, SyncPersistenceFailure>;
};

type DerivedPerformanceCandidateRow = {
  userId: string;
  upstreamActivityId: string;
  distanceMeters: number;
  durationSeconds: number;
  startSampleIndex: number;
  endSampleIndex: number;
  startAt: Date;
};

async function selectCandidatesForDistance(
  db: Database,
  userId: string,
  distanceMeters: number,
) {
  const rows = await db
    .select({
      userId: runBestEffort.userId,
      upstreamActivityId: runBestEffort.upstreamActivityId,
      distanceMeters: runBestEffort.distanceMeters,
      durationSeconds: runBestEffort.durationSeconds,
      startSampleIndex: runBestEffort.startSampleIndex,
      endSampleIndex: runBestEffort.endSampleIndex,
      startAt: importedActivity.startAt,
    })
    .from(runBestEffort)
    .innerJoin(
      importedActivity,
      and(
        eq(importedActivity.userId, runBestEffort.userId),
        eq(
          importedActivity.upstreamActivityId,
          runBestEffort.upstreamActivityId,
        ),
      ),
    )
    .where(
      and(
        eq(runBestEffort.userId, userId),
        eq(runBestEffort.distanceMeters, distanceMeters),
      ),
    )
    .orderBy(
      asc(runBestEffort.durationSeconds),
      asc(importedActivity.startAt),
      asc(runBestEffort.upstreamActivityId),
    );

  return rows satisfies DerivedPerformanceCandidateRow[];
}

async function reconcileDistance(
  db: Database,
  userId: string,
  distanceMeters: number,
) {
  const candidates = (await selectCandidatesForDistance(
    db,
    userId,
    distanceMeters,
  )) as PrCandidate[];
  const allTimeWinner = selectAllTimePr(candidates);
  const monthlyWinners = selectMonthlyPrs(candidates);

  await db
    .update(runBestEffort)
    .set({
      isAllTimePrAfterReconcile: false,
      isMonthlyBestAfterReconcile: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(runBestEffort.userId, userId),
        eq(runBestEffort.distanceMeters, distanceMeters),
      ),
    );

  if (allTimeWinner) {
    await db
      .insert(userAllTimePr)
      .values({
        userId,
        distanceMeters,
        upstreamActivityId: allTimeWinner.upstreamActivityId,
        monthStart: normalizeMonthStart(allTimeWinner.startAt),
        durationSeconds: allTimeWinner.durationSeconds,
        startSampleIndex: allTimeWinner.startSampleIndex,
        endSampleIndex: allTimeWinner.endSampleIndex,
      })
      .onConflictDoUpdate({
        target: [userAllTimePr.userId, userAllTimePr.distanceMeters],
        set: {
          upstreamActivityId: allTimeWinner.upstreamActivityId,
          monthStart: normalizeMonthStart(allTimeWinner.startAt),
          durationSeconds: allTimeWinner.durationSeconds,
          startSampleIndex: allTimeWinner.startSampleIndex,
          endSampleIndex: allTimeWinner.endSampleIndex,
          updatedAt: new Date(),
        },
      });

    await db
      .update(runBestEffort)
      .set({
        isAllTimePrAfterReconcile: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(runBestEffort.userId, userId),
          eq(runBestEffort.distanceMeters, distanceMeters),
          eq(
            runBestEffort.upstreamActivityId,
            allTimeWinner.upstreamActivityId,
          ),
        ),
      );
  } else {
    await db
      .delete(userAllTimePr)
      .where(
        and(
          eq(userAllTimePr.userId, userId),
          eq(userAllTimePr.distanceMeters, distanceMeters),
        ),
      );
  }

  await db
    .delete(userMonthlyBest)
    .where(
      and(
        eq(userMonthlyBest.userId, userId),
        eq(userMonthlyBest.distanceMeters, distanceMeters),
      ),
    );

  const monthlyWinnerRows = [...monthlyWinners.entries()].map(([, winner]) => ({
    userId,
    monthStart: normalizeMonthStart(winner.startAt),
    distanceMeters,
    upstreamActivityId: winner.upstreamActivityId,
    durationSeconds: winner.durationSeconds,
    startSampleIndex: winner.startSampleIndex,
    endSampleIndex: winner.endSampleIndex,
  }));

  if (monthlyWinnerRows.length > 0) {
    await db.insert(userMonthlyBest).values(monthlyWinnerRows);

    for (const winner of monthlyWinners.values()) {
      await db
        .update(runBestEffort)
        .set({
          isMonthlyBestAfterReconcile: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(runBestEffort.userId, userId),
            eq(runBestEffort.distanceMeters, distanceMeters),
            eq(runBestEffort.upstreamActivityId, winner.upstreamActivityId),
          ),
        );
    }
  }

  return {
    allTimePrCount: allTimeWinner ? 1 : 0,
    monthlyBestCount: monthlyWinnerRows.length,
  };
}

export function createDerivedPerformanceRepository(
  db: Database,
): DerivedPerformanceRepository {
  return {
    replaceRunEfforts(input) {
      return Effect.tryPromise({
        try: async () => {
          const previousEffortRows = await db.query.runBestEffort.findMany({
            where: and(
              eq(runBestEffort.userId, input.userId),
              eq(runBestEffort.upstreamActivityId, input.upstreamActivityId),
            ),
          });
          const affectedDistances = [
            ...new Set([
              ...previousEffortRows.map((row) => row.distanceMeters),
              ...input.efforts.map((effort) => effort.distanceMeters),
            ]),
          ];

          return db.transaction(async (tx) => {
            await tx
              .delete(runProcessingWarning)
              .where(
                and(
                  eq(runProcessingWarning.userId, input.userId),
                  eq(
                    runProcessingWarning.upstreamActivityId,
                    input.upstreamActivityId,
                  ),
                ),
              );

            await tx
              .delete(runBestEffort)
              .where(
                and(
                  eq(runBestEffort.userId, input.userId),
                  eq(
                    runBestEffort.upstreamActivityId,
                    input.upstreamActivityId,
                  ),
                ),
              );

            if (input.efforts.length > 0) {
              await tx.insert(runBestEffort).values(
                input.efforts.map((effort) => ({
                  userId: input.userId,
                  upstreamActivityId: input.upstreamActivityId,
                  distanceMeters: effort.distanceMeters,
                  durationSeconds: effort.durationSeconds,
                  startSampleIndex: effort.startSampleIndex,
                  endSampleIndex: effort.endSampleIndex,
                })),
              );
            }

            let allTimePrCount = 0;
            let monthlyBestCount = 0;

            for (const distanceMeters of affectedDistances) {
              const result = await reconcileDistance(
                tx as unknown as Database,
                input.userId,
                distanceMeters,
              );

              allTimePrCount += result.allTimePrCount;
              monthlyBestCount += result.monthlyBestCount;
            }

            return {
              effortCount: input.efforts.length,
              warningCount: 0,
              allTimePrCount,
              monthlyBestCount,
            };
          });
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to replace run best efforts",
            cause,
          }),
      });
    },
    replaceRunWarnings(input) {
      return Effect.tryPromise({
        try: async () => {
          const previousEffortRows = await db.query.runBestEffort.findMany({
            where: and(
              eq(runBestEffort.userId, input.userId),
              eq(runBestEffort.upstreamActivityId, input.upstreamActivityId),
            ),
          });
          const affectedDistances = [
            ...new Set(previousEffortRows.map((row) => row.distanceMeters)),
          ];

          return db.transaction(async (tx) => {
            await tx
              .delete(runBestEffort)
              .where(
                and(
                  eq(runBestEffort.userId, input.userId),
                  eq(
                    runBestEffort.upstreamActivityId,
                    input.upstreamActivityId,
                  ),
                ),
              );

            await tx
              .delete(runProcessingWarning)
              .where(
                and(
                  eq(runProcessingWarning.userId, input.userId),
                  eq(
                    runProcessingWarning.upstreamActivityId,
                    input.upstreamActivityId,
                  ),
                ),
              );

            if (input.warnings.length > 0) {
              await tx.insert(runProcessingWarning).values(
                input.warnings.map((warning) => ({
                  userId: input.userId,
                  upstreamActivityId: input.upstreamActivityId,
                  code: warning.code,
                  message: warning.message,
                  metadata: warning.metadata,
                })),
              );
            }

            let allTimePrCount = 0;
            let monthlyBestCount = 0;

            for (const distanceMeters of affectedDistances) {
              const result = await reconcileDistance(
                tx as unknown as Database,
                input.userId,
                distanceMeters,
              );

              allTimePrCount += result.allTimePrCount;
              monthlyBestCount += result.monthlyBestCount;
            }

            return {
              effortCount: 0,
              warningCount: input.warnings.length,
              allTimePrCount,
              monthlyBestCount,
            };
          });
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to replace run processing warnings",
            cause,
          }),
      });
    },
  };
}
