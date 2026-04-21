import { Effect } from "effect";

import type { GoalProgressService } from "../goal-progress/service";
import {
  addDaysToDateKey,
  getLocalWeekRange,
  localDateKeyToUtcStart,
} from "../goal-progress/timezones";
import type { PlanningDataRepository } from "../planning-data/repository";
import type { TrainingSettingsService } from "../training-settings/service";
import type {
  StoredWeeklySnapshot,
  WeeklySnapshotRepository,
} from "./repository";
import {
  buildWeeklySnapshotComparison,
  buildWeeklySnapshotTotals,
  buildWeeklyWrappedData,
  type WeeklySnapshotRun,
} from "./domain";

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
  trainingSettingsService: Pick<TrainingSettingsService, "getTimezoneForUser">;
  planningRepo: Pick<
    PlanningDataRepository,
    "getHistoryRuns" | "getLatestSuccessfulSync"
  >;
  createGoalProgressServiceAt: (now: Date) => GoalProgressService;
  clock?: Clock;
}) {
  const clock = options.clock ?? { now: () => new Date() };
  const buildWeeklySnapshotRecordForUser = (
    userId: string,
  ): Effect.Effect<
    Parameters<WeeklySnapshotRepository["upsertForUserAndWeek"]>[0],
    unknown
  > =>
    Effect.gen(function* () {
      const timezone =
        yield* options.trainingSettingsService.getTimezoneForUser(userId);
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
          goalProgressService.getForUser(userId),
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
      const previousSnapshot =
        yield* options.snapshotRepo.getLatestBeforeWeekStart({
          userId,
          weekStart: ranges.snapshotWeekStart,
        });
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
      const comparisonBaseTotals =
        previousSnapshot?.payload.totals ??
        buildWeeklySnapshotTotals(priorWeekRuns);

      return {
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
        payload: {
          ...payload,
          comparisonVsPriorWeek: buildWeeklySnapshotComparison({
            current: payload.totals,
            prior: comparisonBaseTotals,
          }),
        },
      };
    });
  const generateWeeklySnapshotForUser = (
    userId: string,
  ): Effect.Effect<StoredWeeklySnapshot, unknown> =>
    Effect.flatMap(buildWeeklySnapshotRecordForUser(userId), (record) =>
      options.snapshotRepo.upsertForUserAndWeek(record),
    );

  const createWeeklySnapshotForUserIfMissing = (
    userId: string,
  ): Effect.Effect<
    { snapshot: StoredWeeklySnapshot; created: boolean },
    unknown
  > =>
    Effect.flatMap(buildWeeklySnapshotRecordForUser(userId), (record) =>
      options.snapshotRepo.createForUserAndWeekIfMissing(record),
    );

  return {
    getLatestForUser(
      userId: string,
    ): Effect.Effect<StoredWeeklySnapshot | null, unknown> {
      return options.snapshotRepo.getLatestForUser(userId);
    },
    listForUser(userId: string) {
      return options.snapshotRepo.listForUser(userId);
    },
    ensureLatestForUser(
      userId: string,
    ): Effect.Effect<StoredWeeklySnapshot, unknown> {
      return Effect.gen(function* () {
        const timezone =
          yield* options.trainingSettingsService.getTimezoneForUser(userId);
        const ranges = buildWeekRanges(clock.now(), timezone);
        const existing = yield* options.snapshotRepo.findByUserAndWeek({
          userId,
          timezone,
          weekStart: ranges.snapshotWeekStart,
          weekEnd: ranges.snapshotWeekEnd,
        });

        if (existing) {
          return existing;
        }

        const created = yield* createWeeklySnapshotForUserIfMissing(userId);
        return created.snapshot;
      });
    },
    getByWeekForUser(input: {
      userId: string;
      weekStart: Date;
      weekEnd: Date;
      timezone: string;
    }): Effect.Effect<StoredWeeklySnapshot | null, unknown> {
      return options.snapshotRepo.findByUserAndWeek({
        userId: input.userId,
        weekStart: input.weekStart,
        weekEnd: input.weekEnd,
        timezone: input.timezone,
      });
    },
    generateWeeklySnapshotForUser(
      userId: string,
    ): Effect.Effect<StoredWeeklySnapshot, unknown> {
      return generateWeeklySnapshotForUser(userId);
    },
    createWeeklySnapshotForUserIfMissing(
      userId: string,
    ): Effect.Effect<
      { snapshot: StoredWeeklySnapshot; created: boolean },
      unknown
    > {
      return createWeeklySnapshotForUserIfMissing(userId);
    },
  };
}
