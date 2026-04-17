import { db, type Database } from "@corex/db";

import { createLiveTrainingSettingsService } from "../training-settings/live";
import { createWeeklyPlanningRepository } from "../weekly-planning/repository";
import { createPlanAdherenceRepository } from "./repository";
import {
  createPlanAdherenceService,
  type PlanAdherenceService,
} from "./service";

type CreateLivePlanAdherenceServiceOptions = {
  db?: Database;
  clock?: {
    now: () => Date;
  };
};

export function createLivePlanAdherenceService(
  options: CreateLivePlanAdherenceServiceOptions = {},
): PlanAdherenceService {
  const database = options.db ?? db;

  return createPlanAdherenceService({
    repo: createPlanAdherenceRepository(database),
    trainingSettingsService: createLiveTrainingSettingsService({
      db: database,
    }),
    weeklyPlanningRepo: createWeeklyPlanningRepository(database),
    clock: options.clock,
  });
}
