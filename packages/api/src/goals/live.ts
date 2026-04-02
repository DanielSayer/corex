import { db, type Database } from "@corex/db";

import { createTrainingSettingsRepository } from "../training-settings/repository";
import { createGoalsApi, type GoalsApi } from "./service";

export function createLiveGoalsApi(
  options: {
    db?: Database;
  } = {},
): GoalsApi {
  const database = options.db ?? db;

  return createGoalsApi({
    repo: createTrainingSettingsRepository(database),
  });
}
