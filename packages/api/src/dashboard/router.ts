import { TRPCError } from "@trpc/server";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { createLiveDashboardService } from "./live";
import type { DashboardService } from "./service";

type CreateDashboardRouterOptions = {
  service?: Pick<DashboardService, "getForUser">;
};

function mapDashboardError(error: unknown) {
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Dashboard request failed",
    cause: error,
  });
}

export function createDashboardRouter(
  options: CreateDashboardRouterOptions = {},
) {
  const getService = () => options.service ?? createLiveDashboardService();

  return router({
    get: authedProcedure.query(({ ctx }) =>
      executeEffect(
        getService().getForUser(ctx.session.user.id),
        mapDashboardError,
      ),
    ),
  });
}

export const dashboardRouter = createDashboardRouter();
