import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@corex/api/routers/index";

type InferRouterOutputs<TRouter extends AppRouter> =
  inferRouterOutputs<TRouter>;

export type ActivityHistoryRouterOutputs =
  InferRouterOutputs<AppRouter>["activityHistory"];
