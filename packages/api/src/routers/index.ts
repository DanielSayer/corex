import { getHealthCheck } from "../application/queries/health-check";
import { getPrivateData } from "../application/queries/private-data";
import { publicProcedure, router } from "../index";
import { trainingSettingsRouter } from "../training-settings/router";

type CreateAppRouterOptions = {
  trainingSettings?: typeof trainingSettingsRouter;
};

export function createAppRouter(options: CreateAppRouterOptions = {}) {
  return router({
    healthCheck: publicProcedure.query(() => getHealthCheck()),
    privateData: publicProcedure.query(({ ctx }) => getPrivateData(ctx.session)),
    trainingSettings: options.trainingSettings ?? trainingSettingsRouter,
  });
}

export const appRouter = createAppRouter();
export type AppRouter = typeof appRouter;
