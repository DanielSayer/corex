import { db, type Database } from "@corex/db";

import { createPlanningDataRepository } from "./repository";
import { createPlanningDataService, type PlanningDataService } from "./service";

type Clock = {
  now: () => Date;
};

export function createLivePlanningDataService(
  options: {
    db?: Database;
    clock?: Clock;
  } = {},
): PlanningDataService {
  const database = options.db ?? db;

  return createPlanningDataService({
    repo: createPlanningDataRepository(database),
    clock: options.clock,
  });
}
