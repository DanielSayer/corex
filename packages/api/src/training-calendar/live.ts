import { db, type Database } from "@corex/db";

import { createWeeklyPlanningRepository } from "../weekly-planning/repository";
import { createTrainingCalendarRepository } from "./repository";
import {
  createTrainingCalendarService,
  type TrainingCalendarService,
} from "./service";

export function createLiveTrainingCalendarService(
  options: {
    db?: Database;
  } = {},
): TrainingCalendarService {
  const database = options.db ?? db;

  return createTrainingCalendarService({
    repo: createTrainingCalendarRepository(database),
    weeklyPlanningRepo: createWeeklyPlanningRepository(database),
  });
}
