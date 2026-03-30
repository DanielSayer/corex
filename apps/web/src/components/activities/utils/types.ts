import type { IntervalsSyncRouterOutputs } from "@/utils/types";

type ActivitySummary = NonNullable<
  IntervalsSyncRouterOutputs["activitySummary"]
>;
type ActivityAnalysis = NonNullable<
  IntervalsSyncRouterOutputs["activityAnalysis"]
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
