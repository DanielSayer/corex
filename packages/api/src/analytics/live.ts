import { db, type Database } from "@corex/db";

import { createAnalyticsRepository } from "./repository";
import type { AnalyticsService } from "./service";

export function createLiveAnalyticsService(
  options: {
    db?: Database;
  } = {},
): AnalyticsService {
  return createAnalyticsRepository(options.db ?? db);
}
