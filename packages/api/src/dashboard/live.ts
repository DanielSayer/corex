import { db, type Database } from "@corex/db";

import { createLiveActivityHistoryApi } from "../activity-history/live";
import { createLiveGoalProgressService } from "../goal-progress/live";
import { createLiveIntervalsSyncApi } from "../intervals-sync/live";
import { createPlanningDataRepository } from "../planning-data/repository";
import { createLiveTrainingSettingsService } from "../training-settings/live";
import { createWeeklyPlanningRepository } from "../weekly-planning/repository";
import { createDashboardService, type DashboardService } from "./service";

export function createLiveDashboardService(
  options: {
    db?: Database;
  } = {},
): DashboardService {
  const database = options.db ?? db;
  const trainingSettingsService = createLiveTrainingSettingsService({
    db: database,
  });

  return createDashboardService({
    trainingSettingsService,
    planningRepo: createPlanningDataRepository(database),
    weeklyPlanningRepo: createWeeklyPlanningRepository(database),
    goalProgressService: createLiveGoalProgressService({
      db: database,
    }),
    intervalsSyncService: createLiveIntervalsSyncApi({
      db: database,
    }),
    activityHistoryService: createLiveActivityHistoryApi({
      db: database,
    }),
  });
}
