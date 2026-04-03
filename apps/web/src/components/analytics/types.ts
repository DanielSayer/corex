import type { AnalyticsRouterOutputs } from "@/utils/types";

export type AnalyticsView = AnalyticsRouterOutputs["get"];
export type DistanceGranularity = keyof AnalyticsView["distanceTrends"];
