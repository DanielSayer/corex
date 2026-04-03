import { analyticsRouter } from "../analytics/router";
import { activityHistoryRouter } from "../activity-history/router";
import { goalProgressRouter } from "../goal-progress/router";
import { goalsRouter } from "../goals/router";
import { getPrivateData } from "../session/private-data";
import { getHealthCheck } from "../system/health-check";
import { intervalsSyncRouter } from "../intervals-sync/router";
import { publicProcedure, router } from "../index";
import { trainingSettingsRouter } from "../training-settings/router";
import { weeklySnapshotsRouter } from "../weekly-snapshots/router";

type CreateAppRouterOptions = {
  analytics?: typeof analyticsRouter;
  activityHistory?: typeof activityHistoryRouter;
  goalProgress?: typeof goalProgressRouter;
  goals?: typeof goalsRouter;
  trainingSettings?: typeof trainingSettingsRouter;
  intervalsSync?: typeof intervalsSyncRouter;
  weeklySnapshots?: typeof weeklySnapshotsRouter;
};

export function createAppRouter(options: CreateAppRouterOptions = {}) {
  return router({
    healthCheck: publicProcedure.query(() => getHealthCheck()),
    privateData: publicProcedure.query(({ ctx }) =>
      getPrivateData(ctx.session),
    ),
    analytics: options.analytics ?? analyticsRouter,
    activityHistory: options.activityHistory ?? activityHistoryRouter,
    goalProgress: options.goalProgress ?? goalProgressRouter,
    goals: options.goals ?? goalsRouter,
    trainingSettings: options.trainingSettings ?? trainingSettingsRouter,
    intervalsSync: options.intervalsSync ?? intervalsSyncRouter,
    weeklySnapshots: options.weeklySnapshots ?? weeklySnapshotsRouter,
  });
}

export const appRouter = createAppRouter();
export type AppRouter = typeof appRouter;
