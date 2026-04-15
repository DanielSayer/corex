import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
  const getService = () => options.service ?? createLiveAnalyticsService();

  return router({
    get: authedProcedure
      .input(
        z.object({
          year: z.number().int().min(2000).max(2100),
        }),
      )
      .query(({ ctx, input }) =>
        executeEffect(
          getService().getForUser(ctx.session.user.id, input),
          mapAnalyticsError,
        ),
      ),
  });
}

export const analyticsRouter = createAnalyticsRouter();
