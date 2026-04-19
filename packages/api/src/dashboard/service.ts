import { Effect } from "effect";

import type { ActivityHistoryApi } from "../activity-history/service";
import type { GoalProgressService } from "../goal-progress/service";
import {
  addDaysToDateKey,
  getLocalDateKey,
  localDateKeyToUtcStart,
  startOfWeekKey,
} from "../goal-progress/timezones";
import type { IntervalsSyncApi } from "../intervals-sync/module";
import { toSyncStatusSummary } from "../intervals-sync/summary";
import type { PlanningDataRepository } from "../planning-data/repository";
import type { TrainingSettingsService } from "../training-settings/service";
import type { WeeklyPlanningRepository } from "../weekly-planning/repository";
import type { DashboardView } from "./contracts";
import {
  buildDashboardGoalRows,
  buildDashboardTodaySummary,
  buildDashboardWeeklySummary,
  DASHBOARD_SERIES_WEEKS,
} from "./domain";

type Clock = {
  now: () => Date;
};

export type DashboardService = ReturnType<typeof createDashboardService>;

export function createDashboardService(options: {
  trainingSettingsService: Pick<TrainingSettingsService, "getTimezoneForUser">;
  planningRepo: Pick<PlanningDataRepository, "getHistoryRuns">;
  weeklyPlanningRepo: Pick<WeeklyPlanningRepository, "getFinalizedPlanForDate">;
  goalProgressService: Pick<GoalProgressService, "getForUser">;
  intervalsSyncService: Pick<IntervalsSyncApi, "latest">;
  activityHistoryService: Pick<ActivityHistoryApi, "recentActivities">;
  clock?: Clock;
}) {
  const clock = options.clock ?? { now: () => new Date() };

  return {
    getForUser(userId: string): Effect.Effect<DashboardView, unknown> {
      return Effect.gen(function* () {
        const timezone =
          yield* options.trainingSettingsService.getTimezoneForUser(userId);
        const now = clock.now();
        const localDate = getLocalDateKey(now, timezone);
        const currentWeekStart = startOfWeekKey(localDate);
        const earliestSeriesWeekStart = addDaysToDateKey(
          currentWeekStart,
          -7 * (DASHBOARD_SERIES_WEEKS - 1),
        );
        const since = localDateKeyToUtcStart(earliestSeriesWeekStart, timezone);
        const [
          runs,
          finalizedPlan,
          goalProgress,
          latestSync,
          recentActivities,
        ] = yield* Effect.all([
          options.planningRepo.getHistoryRuns(userId, since),
          options.weeklyPlanningRepo.getFinalizedPlanForDate(userId, localDate),
          options.goalProgressService.getForUser(userId),
          options.intervalsSyncService.latest(userId),
          options.activityHistoryService.recentActivities(userId),
        ]);

        return {
          timezone,
          sync: latestSync ? toSyncStatusSummary(latestSync) : null,
          today: buildDashboardTodaySummary({
            now,
            timezone,
            plan: finalizedPlan,
          }),
          weekly: buildDashboardWeeklySummary({
            now,
            timezone,
            runs: runs.map((run) => ({
              startAt: run.startAt,
              summaryDate: run.summaryDate,
              distanceMeters: run.distanceMeters,
              elapsedTimeSeconds: run.elapsedTimeSeconds,
            })),
          }),
          goals: buildDashboardGoalRows(goalProgress.activeGoals),
          recentActivities,
        };
      });
    },
  };
}
