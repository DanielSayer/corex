import { db, type Database } from "@corex/db";
import { Effect } from "effect";

import { createAnalyticsRepository } from "./repository";
import type { AnalyticsService } from "./service";
import { createLiveTrainingSettingsService } from "../training-settings/live";

export function createLiveAnalyticsService(
  options: {
    db?: Database;
  } = {},
): AnalyticsService {
  const database = options.db ?? db;
  const repository = createAnalyticsRepository(database);
  const trainingSettingsService = createLiveTrainingSettingsService({
    db: database,
  });

  return {
    getForUser(userId, input) {
      return Effect.gen(function* () {
        const timezone =
          yield* trainingSettingsService.getTimezoneForUser(userId);
        return yield* repository.getForUserInTimezone(userId, {
          ...input,
          timezone,
        });
      });
    },
  };
}
