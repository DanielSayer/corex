import { db, type Database } from "@corex/db";

import { createLiveGoalProgressService } from "../goal-progress/live";
import { createPlanningDataRepository } from "../planning-data/repository";
import { createLiveTrainingSettingsService } from "../training-settings/live";
import { createWeeklySnapshotRepository } from "./repository";
import {
  createWeeklySnapshotService,
  type WeeklySnapshotService,
} from "./service";

type Clock = {
  now: () => Date;
};

export function createLiveWeeklySnapshotService(
  options: {
    db?: Database;
    clock?: Clock;
  } = {},
): WeeklySnapshotService {
  const database = options.db ?? db;
  const planningRepo = createPlanningDataRepository(database);

  return createWeeklySnapshotService({
    snapshotRepo: createWeeklySnapshotRepository(database),
    trainingSettingsService: createLiveTrainingSettingsService({
      db: database,
    }),
    planningRepo,
    createGoalProgressServiceAt: (now) =>
      createLiveGoalProgressService({
        db: database,
        clock: { now: () => now },
      }),
    clock: options.clock,
  });
}
