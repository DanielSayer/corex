import { getPrivateData } from "../session/private-data";
import { getHealthCheck } from "../system/health-check";
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
