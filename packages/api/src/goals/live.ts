import { db, type Database } from "@corex/db";

import { createGoalRepository } from "./repository";
import { createTrainingSettingsRepository } from "../training-settings/repository";
import { createGoalsApi, type GoalsApi } from "./service";

export function createLiveGoalsApi(
  options: {
    db?: Database;
  } = {},
): GoalsApi {
  const database = options.db ?? db;

  return createGoalsApi({
    repo: createGoalRepository(database),
    trainingSettingsRepo: createTrainingSettingsRepository(database),
  });
}
