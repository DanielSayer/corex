import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@corex/db";
import {
  importedActivity,
  runBestEffort,
  userAllTimePr,
  userMonthlyBest,
} from "@corex/db/schema/intervals-sync";

import type { PrCandidate } from "./derived-performance";
import {
  normalizeMonthStart,
  selectAllTimePr,
  selectMonthlyPrs,
} from "./derived-performance";
import type { DerivedPerformanceCandidateRow } from "./derived-performance-repository-types";

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

export async function reconcileDistance(
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
