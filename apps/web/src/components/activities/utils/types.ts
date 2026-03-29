import type { IntervalsSyncRouterOutputs } from "@/utils/types";

type ActivityDetails = NonNullable<
  IntervalsSyncRouterOutputs["activityDetails"]
>;
type ActivityMapData = NonNullable<ActivityDetails["mapData"]>;
type ActivitySplit = ActivityDetails["intervals"][number];
type BestEffort = ActivityDetails["bestEfforts"][number];

export type { ActivityDetails, ActivityMapData, ActivitySplit, BestEffort };
