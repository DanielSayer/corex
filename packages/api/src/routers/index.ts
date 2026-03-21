import { getHealthCheck } from "../application/queries/health-check";
import { getPrivateData } from "../application/queries/private-data";
import { intervalsSyncRouter } from "../intervals-sync/router";
import { publicProcedure, router } from "../index";
import { trainingSettingsRouter } from "../training-settings/router";

type CreateAppRouterOptions = {
  trainingSettings?: typeof trainingSettingsRouter;
  intervalsSync?: typeof intervalsSyncRouter;
};

export function createAppRouter(options: CreateAppRouterOptions = {}) {
  return router({
    healthCheck: publicProcedure.query(() => getHealthCheck()),
    privateData: publicProcedure.query(({ ctx }) =>
      getPrivateData(ctx.session),
    ),
    trainingSettings: options.trainingSettings ?? trainingSettingsRouter,
    intervalsSync: options.intervalsSync ?? intervalsSyncRouter,
  });
}

export const appRouter = createAppRouter();
export type AppRouter = typeof appRouter;
