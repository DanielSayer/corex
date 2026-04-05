import { db, type Database } from "@corex/db";
import { env } from "@corex/env/server";

import { createLivePlanningDataService } from "../planning-data/live";
import { createLiveTrainingSettingsService } from "../training-settings/live";
import { createOpenAiPlannerModel } from "./openai-model";
import { createWeeklyPlanningRepository } from "./repository";
import {
  createWeeklyPlanningService,
  type WeeklyPlanningService,
} from "./service";

type CreateLiveWeeklyPlanningServiceOptions = {
  db?: Database;
};

export function createLiveWeeklyPlanningService(
  options: CreateLiveWeeklyPlanningServiceOptions = {},
): WeeklyPlanningService {
  const database = options.db ?? db;

  return createWeeklyPlanningService({
    trainingSettingsService: createLiveTrainingSettingsService({
      db: database,
    }),
    planningDataService: createLivePlanningDataService({ db: database }),
    repo: createWeeklyPlanningRepository(database),
    model: createOpenAiPlannerModel({
      apiKey: env.OPENAI_API_KEY,
      model: env.PLANNER_OPENAI_MODEL,
    }),
  });
}
