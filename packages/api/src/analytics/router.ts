import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isValidTimeZone } from "../goal-progress/timezones";
import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { createLiveAnalyticsService } from "./live";
import type { AnalyticsService } from "./service";

type CreateAnalyticsRouterOptions = {
  service?: AnalyticsService;
};

function mapAnalyticsError(error: unknown) {
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Analytics request failed",
    cause: error,
  });
}

export function createAnalyticsRouter(
  options: CreateAnalyticsRouterOptions = {},
) {
  const service = options.service ?? createLiveAnalyticsService();

  return router({
    get: authedProcedure
      .input(
        z.object({
          year: z.number().int().min(2000).max(2100),
          timezone: z.string().trim().min(1).refine(isValidTimeZone, {
            message: "Invalid timezone",
          }),
        }),
      )
      .query(({ ctx, input }) =>
        executeEffect(
          service.getForUser(ctx.session.user.id, input),
          mapAnalyticsError,
        ),
      ),
  });
}

export const analyticsRouter = createAnalyticsRouter();
