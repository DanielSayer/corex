import { Effect } from "effect";

import { getGoalStatus } from "../goals/domain";
import type { GoalRepository, StoredGoal } from "../goals/repository";
import type { PlanningPerformanceSnapshot } from "../planning-data/contracts";
import type {
  PlanningDataRepository,
  PlanningHistorySourceRow,
} from "../planning-data/repository";
import { createPlanningDataService } from "../planning-data/service";
import type {
  EventGoalProgressCard,
  GoalProgressCard,
  GoalProgressView,
} from "./contracts";
import type { TrainingSettingsService } from "../training-settings/service";
import {
  buildEventGoalProgress,
  buildGoalProgressSyncState,
  buildVolumeGoalProgress,
  getGoalProgressStatus,
} from "./domain";
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  getLocalDateKey,
  getLocalMonthRange,
  getLocalWeekRange,
  localDateKeyToUtcStart,
} from "./timezones";

type Clock = {
  now: () => Date;
};

type MappedRun = {
  startAt: Date;
  distanceMeters: number;
  movingTimeSeconds: number;
};

export type GoalProgressService = ReturnType<typeof createGoalProgressService>;

function mapRuns(rows: PlanningHistorySourceRow[]): MappedRun[] {
  return rows.map((row) => ({
    startAt: row.startAt,
    distanceMeters: row.distanceMeters,
    movingTimeSeconds: row.movingTimeSeconds,
  }));
}

function getGoalTitle(goal: StoredGoal["goal"]) {
  if (goal.type === "event_goal") {
    return goal.eventName?.trim() || "Event goal";
  }

  return `${goal.period === "week" ? "Weekly" : "Monthly"} ${goal.metric} goal`;
}

function getVolumeTrendStart(
  goal: Extract<StoredGoal["goal"], { type: "volume_goal" }>,
  now: Date,
  timezone: string,
) {
  const periodRange =
    goal.period === "week"
      ? getLocalWeekRange(now, timezone)
      : getLocalMonthRange(now, timezone);

  return goal.period === "week"
    ? localDateKeyToUtcStart(
        addDaysToDateKey(periodRange.startKey, -21),
        timezone,
      )
    : localDateKeyToUtcStart(
        addMonthsToDateKey(periodRange.startKey, -3),
        timezone,
      );
}

function mapPerformanceSnapshot(snapshot: PlanningPerformanceSnapshot | null) {
  return (
    snapshot?.allTimePrs.map((pr) => ({
      distanceMeters: pr.distanceMeters,
      durationSeconds: pr.durationSeconds,
      activityId: pr.activityId,
      startAt: new Date(pr.startAt),
      startSampleIndex: pr.startSampleIndex,
      endSampleIndex: pr.endSampleIndex,
    })) ?? []
  );
}

export function createGoalProgressService(options: {
  goalsRepo: Pick<GoalRepository, "listByUserId">;
  planningRepo: Pick<PlanningDataRepository, "getHistoryRuns">;
  trainingSettingsService: Pick<TrainingSettingsService, "getTimezoneForUser">;
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
        const timezone =
          yield* options.trainingSettingsService.getTimezoneForUser(userId);
        const now = clock.now();
        const today = getLocalDateKey(now, timezone);
        const storedGoals = yield* options.goalsRepo.listByUserId(userId);
        const activeGoals = storedGoals.filter(
          (item) => getGoalStatus(item.goal, today) === "active",
        );
        const completedEventGoals = storedGoals.filter(
          (
            item,
          ): item is StoredGoal & {
            goal: Extract<StoredGoal["goal"], { type: "event_goal" }>;
          } =>
            item.goal.type === "event_goal" &&
            getGoalStatus(item.goal, today) === "completed",
        );

        if (storedGoals.length === 0) {
          return {
            timezone,
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
            activeGoals: [],
            completedGoals: [],
          };
        }

        const primaryGoal =
          activeGoals[0]?.goal ?? completedEventGoals[0]?.goal ?? null;
        const historyQuality =
          yield* options.planningDataService.getHistoryQuality(userId);
        const status = getGoalProgressStatus({
          goal: primaryGoal,
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

        let volumeRuns: MappedRun[] = [];
        let eventRuns: MappedRun[] = [];
        let performanceSnapshot: PlanningPerformanceSnapshot | null = null;

        if (status === "ready") {
          const activeVolumeGoals = activeGoals.filter(
            (
              item,
            ): item is StoredGoal & {
              goal: Extract<StoredGoal["goal"], { type: "volume_goal" }>;
            } => item.goal.type === "volume_goal",
          );
          const anyEventGoals =
            activeGoals.some((item) => item.goal.type === "event_goal") ||
            completedEventGoals.length > 0;

          if (activeVolumeGoals.length > 0) {
            const trendStart = activeVolumeGoals.reduce<Date | null>(
              (earliest, item) => {
                const candidate = getVolumeTrendStart(item.goal, now, timezone);
                if (!earliest || candidate < earliest) {
                  return candidate;
                }

                return earliest;
              },
              null,
            );

            if (trendStart) {
              volumeRuns = mapRuns(
                yield* options.planningRepo.getHistoryRuns(userId, trendStart),
              );
            }
          }

          if (anyEventGoals) {
            const eventLookbackStart = new Date(now);
            eventLookbackStart.setUTCDate(eventLookbackStart.getUTCDate() - 56);
            const [historyRows, performance] = yield* Effect.all([
              options.planningRepo.getHistoryRuns(userId, eventLookbackStart),
              options.planningDataService.getPlanningPerformanceSnapshot(
                userId,
              ),
            ]);
            eventRuns = mapRuns(historyRows);
            performanceSnapshot = performance;
          }
        }

        const mappedPerformance = mapPerformanceSnapshot(performanceSnapshot);

        const activeGoalCards: GoalProgressCard[] = activeGoals.map((item) => {
          if (item.goal.type === "volume_goal") {
            return {
              goalId: item.id,
              goalType: "volume_goal",
              status: "active" as const,
              title: getGoalTitle(item.goal),
              goal: item.goal,
              progress:
                status === "ready"
                  ? buildVolumeGoalProgress({
                      now,
                      timezone,
                      goal: item.goal,
                      runs: volumeRuns,
                    })
                  : null,
            };
          }

          const progress =
            status === "ready"
              ? buildEventGoalProgress({
                  now,
                  timezone,
                  goal: item.goal,
                  runs: eventRuns,
                  prs: mappedPerformance,
                })
              : null;

          return {
            goalId: item.id,
            goalType: "event_goal" as const,
            status: "active" as const,
            title: getGoalTitle(item.goal),
            goal: item.goal,
            progress,
            readinessScore: progress?.readiness.score ?? null,
          };
        });

        const completedGoalCards: EventGoalProgressCard[] =
          completedEventGoals.map((item) => {
            const progress =
              status === "ready"
                ? buildEventGoalProgress({
                    now,
                    timezone,
                    goal: item.goal,
                    runs: eventRuns,
                    prs: mappedPerformance,
                  })
                : null;

            return {
              goalId: item.id,
              goalType: "event_goal" as const,
              status: "completed" as const,
              title: getGoalTitle(item.goal),
              goal: item.goal,
              progress,
              readinessScore: progress?.readiness.score ?? null,
            };
          });

        return {
          timezone,
          sync,
          activeGoals: activeGoalCards,
          completedGoals: completedGoalCards,
        };
      });
    },
  };
}
