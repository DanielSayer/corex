import { analyticsRouter } from "../analytics/router";
import { activityHistoryRouter } from "../activity-history/router";
import { goalProgressRouter } from "../goal-progress/router";
import { goalsRouter } from "../goals/router";
import { getPrivateData } from "../session/private-data";
import { getHealthCheck } from "../system/health-check";
import { intervalsSyncRouter } from "../intervals-sync/router";
import { planAdherenceRouter } from "../plan-adherence/router";
import { publicProcedure, router } from "../index";
import { trainingCalendarRouter } from "../training-calendar/router";
import { trainingSettingsRouter } from "../training-settings/router";
import { weeklyPlanningRouter } from "../weekly-planning/router";
import { weeklySnapshotsRouter } from "../weekly-snapshots/router";

type CreateAppRouterOptions = {
  analytics?: typeof analyticsRouter;
  activityHistory?: typeof activityHistoryRouter;
  goalProgress?: typeof goalProgressRouter;
  goals?: typeof goalsRouter;
  trainingSettings?: typeof trainingSettingsRouter;
  trainingCalendar?: typeof trainingCalendarRouter;
  intervalsSync?: typeof intervalsSyncRouter;
  planAdherence?: typeof planAdherenceRouter;
  weeklyPlanning?: typeof weeklyPlanningRouter;
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
    trainingCalendar: options.trainingCalendar ?? trainingCalendarRouter,
    intervalsSync: options.intervalsSync ?? intervalsSyncRouter,
    planAdherence: options.planAdherence ?? planAdherenceRouter,
    weeklyPlanning: options.weeklyPlanning ?? weeklyPlanningRouter,
    weeklySnapshots: options.weeklySnapshots ?? weeklySnapshotsRouter,
  });
}

export const appRouter = createAppRouter();
export type AppRouter = typeof appRouter;
