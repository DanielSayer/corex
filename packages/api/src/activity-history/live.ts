import { db, type Database } from "@corex/db";

import { createActivityHistoryRepository } from "./repository";
import type { ActivityHistoryApi } from "./service";

export function createLiveActivityHistoryApi(
  options: {
    db?: Database;
  } = {},
): ActivityHistoryApi {
  const database = options.db ?? db;

  return createActivityHistoryRepository(database);
}
