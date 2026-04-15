import type { Effect } from "effect";

import type { AnalyticsView } from "./contracts";

export type AnalyticsRepository = {
  getForUserInTimezone: (
    userId: string,
    input: {
      year: number;
      timezone: string;
    },
  ) => Effect.Effect<AnalyticsView, unknown>;
};

export type AnalyticsService = {
  getForUser: (
    userId: string,
    input: {
      year: number;
    },
  ) => Effect.Effect<AnalyticsView, unknown>;
};
