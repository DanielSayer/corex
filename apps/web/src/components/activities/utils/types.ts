import type { ActivityHistoryRouterOutputs } from "@/utils/types";

type ActivitySummary = NonNullable<
  ActivityHistoryRouterOutputs["activitySummary"]
>;
type ActivityAnalysis = NonNullable<
  ActivityHistoryRouterOutputs["activityAnalysis"]
>;
type ActivityMapData = NonNullable<ActivitySummary["mapPreview"]>;
type ActivitySplit = ActivitySummary["intervals"][number];
type BestEffort = ActivitySummary["bestEfforts"][number];
type ActivityMetricKey = keyof ActivityAnalysis;
type ActivityMetricPoint = ActivityAnalysis[ActivityMetricKey][number];

export type {
  ActivitySummary,
  ActivityAnalysis,
  ActivityMapData,
  ActivitySplit,
  BestEffort,
  ActivityMetricKey,
  ActivityMetricPoint,
};
