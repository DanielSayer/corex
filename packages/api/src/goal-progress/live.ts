import { db, type Database } from "@corex/db";

import { createGoalRepository } from "../goals/repository";
import { createPlanningDataRepository } from "../planning-data/repository";
import { createPlanningDataService } from "../planning-data/service";
import { createLiveTrainingSettingsService } from "../training-settings/live";
import { createGoalProgressService, type GoalProgressService } from "./service";

type Clock = {
  now: () => Date;
};

export function createLiveGoalProgressService(
  options: {
    db?: Database;
    clock?: Clock;
  } = {},
): GoalProgressService {
  const database = options.db ?? db;
  const planningRepo = createPlanningDataRepository(database);

  return createGoalProgressService({
    goalsRepo: createGoalRepository(database),
    planningRepo,
    trainingSettingsService: createLiveTrainingSettingsService({
      db: database,
    }),
    planningDataService: createPlanningDataService({
      repo: planningRepo,
      clock: options.clock,
    }),
    clock: options.clock,
  });
}
