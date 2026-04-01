import type { Effect } from "effect";

import type {
  ActivityAnalysisData,
  ActivitySummaryPageData,
} from "./activity-details";
import type {
  ActivityCalendarData,
  ActivityCalendarQueryInput,
} from "./activity-calendar";
import type { ActivityHistoryPersistenceFailure } from "./errors";
import type { RecentActivityPreview } from "./recent-activity";

export type ActivityHistoryApi = {
  recentActivities: (
    userId: string,
  ) => Effect.Effect<
    RecentActivityPreview[],
    ActivityHistoryPersistenceFailure
  >;
  activitySummary: (
    userId: string,
    activityId: string,
  ) => Effect.Effect<
    ActivitySummaryPageData | null,
    ActivityHistoryPersistenceFailure
  >;
  activityAnalysis: (
    userId: string,
    activityId: string,
  ) => Effect.Effect<
    ActivityAnalysisData | null,
    ActivityHistoryPersistenceFailure
  >;
  calendar: (
    userId: string,
    input: ActivityCalendarQueryInput,
  ) => Effect.Effect<ActivityCalendarData, ActivityHistoryPersistenceFailure>;
};
