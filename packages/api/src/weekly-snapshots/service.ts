import { Effect } from "effect";

import type { GoalProgressService } from "../goal-progress/service";
import {
  addDaysToDateKey,
  getLocalWeekRange,
  localDateKeyToUtcStart,
} from "../goal-progress/timezones";
import type { PlanningDataRepository } from "../planning-data/repository";
import type {
  StoredWeeklySnapshot,
  WeeklySnapshotRepository,
} from "./repository";
import { buildWeeklyWrappedData, type WeeklySnapshotRun } from "./domain";

type Clock = {
  now: () => Date;
};

function mapRuns(
  rows: Awaited<
    ReturnType<PlanningDataRepository["getHistoryRuns"]>
  > extends Effect.Effect<infer T, unknown>
    ? T
    : never,
): WeeklySnapshotRun[] {
  return rows.map((row) => ({
    startAt: row.startAt,
    distanceMeters: row.distanceMeters,
    elapsedTimeSeconds: row.elapsedTimeSeconds,
    movingTimeSeconds: row.movingTimeSeconds,
  }));
}

function buildWeekRanges(now: Date, timezone: string) {
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

function buildSnapshotId(input: {
  userId: string;
  timezone: string;
  weekStart: Date;
}) {
  return `weekly-snapshot:${input.userId}:${input.timezone}:${input.weekStart.toISOString()}`;
}

export type WeeklySnapshotService = ReturnType<
  typeof createWeeklySnapshotService
>;

export function createWeeklySnapshotService(options: {
  snapshotRepo: WeeklySnapshotRepository;
  planningRepo: Pick<
    PlanningDataRepository,
    "getHistoryRuns" | "getLatestSuccessfulSync"
  >;
  createGoalProgressServiceAt: (now: Date) => GoalProgressService;
  clock?: Clock;
}) {
  const clock = options.clock ?? { now: () => new Date() };

  return {
    getLatestForUser(
      userId: string,
    ): Effect.Effect<StoredWeeklySnapshot | null, unknown> {
      return options.snapshotRepo.getLatestForUser(userId);
    },
    getByWeekForUser(input: {
      userId: string;
      timezone: string;
      weekStart: Date;
      weekEnd: Date;
    }): Effect.Effect<StoredWeeklySnapshot | null, unknown> {
      return options.snapshotRepo.findByUserAndWeek(input);
    },
    generateWeeklySnapshotForUser(
      userId: string,
      timezone: string,
    ): Effect.Effect<StoredWeeklySnapshot, unknown> {
      return Effect.gen(function* () {
        const now = clock.now();
        const ranges = buildWeekRanges(now, timezone);
        const evaluationTime = new Date(ranges.snapshotWeekEnd.getTime() - 1);
        const goalProgressService =
          options.createGoalProgressServiceAt(evaluationTime);

        const [historyRows, latestSuccessfulSync, goalProgress] =
          yield* Effect.all([
            options.planningRepo.getHistoryRuns(
              userId,
              ranges.comparisonWeekStart,
            ),
            options.planningRepo.getLatestSuccessfulSync(userId),
            goalProgressService.getForUser(userId, timezone),
          ]);

        const runs = mapRuns(historyRows);
        const currentWeekRuns = runs.filter(
          (run) =>
            run.startAt >= ranges.snapshotWeekStart &&
            run.startAt < ranges.snapshotWeekEnd,
        );
        const priorWeekRuns = runs.filter(
          (run) =>
            run.startAt >= ranges.comparisonWeekStart &&
            run.startAt < ranges.comparisonWeekEnd,
        );
        const payload = buildWeeklyWrappedData({
          generatedAt: now,
          timezone,
          weekStart: ranges.snapshotWeekStart,
          weekEnd: ranges.snapshotWeekEnd,
          currentWeekRuns,
          priorWeekRuns,
          goalCards: [
            ...goalProgress.activeGoals,
            ...goalProgress.completedGoals,
          ],
        });

        return yield* options.snapshotRepo.upsertForUserAndWeek({
          id: buildSnapshotId({
            userId,
            timezone,
            weekStart: ranges.snapshotWeekStart,
          }),
          userId,
          timezone,
          weekStart: ranges.snapshotWeekStart,
          weekEnd: ranges.snapshotWeekEnd,
          generatedAt: now,
          sourceSyncCompletedAt: latestSuccessfulSync?.completedAt ?? null,
          payload,
        });
      });
    },
  };
}
