import { Effect } from "effect";

import type {
  PlanningDataRepository,
  PlanningHistorySourceRow,
} from "../planning-data/repository";
import { createPlanningDataService } from "../planning-data/service";
import type { TrainingSettingsRepository } from "../training-settings/repository";
import type { GoalProgressView } from "./contracts";
import {
  buildEventGoalProgress,
  buildGoalProgressSyncState,
  buildVolumeGoalProgress,
  getGoalProgressStatus,
  getUtcMonthRange,
  getUtcWeekRange,
} from "./domain";

type Clock = {
  now: () => Date;
};

export type GoalProgressService = ReturnType<typeof createGoalProgressService>;

function mapRuns(rows: PlanningHistorySourceRow[]) {
  return rows.map((row) => ({
    startAt: row.startAt,
    distanceMeters: row.distanceMeters,
    movingTimeSeconds: row.movingTimeSeconds,
  }));
}

export function createGoalProgressService(options: {
  trainingRepo: TrainingSettingsRepository;
  planningRepo: Pick<PlanningDataRepository, "getHistoryRuns">;
  planningDataService: Pick<
    ReturnType<typeof createPlanningDataService>,
    "getHistoryQuality" | "getPlanningPerformanceSnapshot"
  >;
  clock?: Clock;
}) {
  const clock = options.clock ?? { now: () => new Date() };

  return {
    getForUser(userId: string): Effect.Effect<GoalProgressView, unknown> {
      return Effect.gen(function* () {
        const stored = yield* options.trainingRepo.findByUserId(userId);
        const goal = stored?.goal ?? null;

        if (!goal) {
          return {
            status: "no_goal" as const,
            goal: null,
            progressKind: null,
            sync: buildGoalProgressSyncState({
              status: "no_goal",
              hasAnyHistory: false,
              hasRecentSync: false,
              latestSyncWarnings: [],
              availableDateRange: {
                start: null,
                end: null,
              },
            }),
            volumeProgress: null,
            eventProgress: null,
          };
        }

        const historyQuality =
          yield* options.planningDataService.getHistoryQuality(userId);
        const status = getGoalProgressStatus({
          goal,
          hasAnyHistory: historyQuality.hasAnyHistory,
          hasRecentSync: historyQuality.hasRecentSync,
        });
        const sync = buildGoalProgressSyncState({
          status,
          hasAnyHistory: historyQuality.hasAnyHistory,
          hasRecentSync: historyQuality.hasRecentSync,
          latestSyncWarnings: historyQuality.latestSyncWarnings,
          availableDateRange: historyQuality.availableDateRange,
        });

        if (status !== "ready") {
          return {
            status,
            goal,
            progressKind: goal.type,
            sync,
            volumeProgress: null,
            eventProgress: null,
          };
        }

        if (goal.type === "volume_goal") {
          const now = clock.now();
          const periodRange =
            goal.period === "week"
              ? getUtcWeekRange(now)
              : getUtcMonthRange(now);
          const trendStart =
            goal.period === "week"
              ? new Date(
                  new Date(periodRange.start).setUTCDate(
                    periodRange.start.getUTCDate() - 21,
                  ),
                )
              : new Date(
                  Date.UTC(
                    periodRange.start.getUTCFullYear(),
                    periodRange.start.getUTCMonth() - 3,
                    1,
                    0,
                    0,
                    0,
                    0,
                  ),
                );
          const runs = yield* options.planningRepo.getHistoryRuns(
            userId,
            trendStart,
          );

          return {
            status,
            goal,
            progressKind: "volume_goal" as const,
            sync,
            volumeProgress: buildVolumeGoalProgress({
              now,
              goal,
              runs: mapRuns(runs),
            }),
            eventProgress: null,
          };
        }

        const now = clock.now();
        const eventLookbackStart = new Date(now);
        eventLookbackStart.setUTCDate(eventLookbackStart.getUTCDate() - 56);
        const [runs, performance] = yield* Effect.all([
          options.planningRepo.getHistoryRuns(userId, eventLookbackStart),
          options.planningDataService.getPlanningPerformanceSnapshot(userId),
        ]);

        return {
          status,
          goal,
          progressKind: "event_goal" as const,
          sync,
          volumeProgress: null,
          eventProgress: buildEventGoalProgress({
            now,
            goal,
            runs: mapRuns(runs),
            prs: performance.allTimePrs.map((pr) => ({
              distanceMeters: pr.distanceMeters,
              durationSeconds: pr.durationSeconds,
              activityId: pr.activityId,
              startAt: new Date(pr.startAt),
              startSampleIndex: pr.startSampleIndex,
              endSampleIndex: pr.endSampleIndex,
            })),
          }),
        };
      });
    },
  };
}
