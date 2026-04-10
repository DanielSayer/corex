import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@corex/api/routers/index";

type InferRouterOutputs<TRouter extends AppRouter> =
  inferRouterOutputs<TRouter>;

export type AnalyticsRouterOutputs = InferRouterOutputs<AppRouter>["analytics"];

export type ActivityHistoryRouterOutputs =
  InferRouterOutputs<AppRouter>["activityHistory"];

export type GoalProgressRouterOutputs =
  InferRouterOutputs<AppRouter>["goalProgress"];

export type GoalsRouterOutputs = InferRouterOutputs<AppRouter>["goals"];

export type TrainingCalendarRouterOutputs =
  InferRouterOutputs<AppRouter>["trainingCalendar"];

export type WeeklySnapshotsRouterOutputs =
  InferRouterOutputs<AppRouter>["weeklySnapshots"];

export type PlannerRouterOutputs =
  InferRouterOutputs<AppRouter>["weeklyPlanning"];
