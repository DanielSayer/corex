import { db, type Database } from "@corex/db";

import { createPlanningDataRepository } from "../planning-data/repository";
import { createPlanningDataService } from "../planning-data/service";
import { createTrainingSettingsRepository } from "../training-settings/repository";
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
    trainingRepo: createTrainingSettingsRepository(database),
    planningRepo,
    planningDataService: createPlanningDataService({
      repo: planningRepo,
      clock: options.clock,
    }),
    clock: options.clock,
  });
}
