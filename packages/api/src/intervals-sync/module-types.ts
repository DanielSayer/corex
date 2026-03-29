import type { Effect } from "effect";

import type { ActivityDetailsPageData } from "./activity-details";
import type { IntervalsAccountPort } from "../intervals/account";
import type { IntervalsUpstreamPort } from "./adapter";
import type { DerivedPerformancePort } from "./derived-performance-service";
import type { IntervalsSyncError, SyncPersistenceFailure } from "./errors";
import type { RecentActivityPreview } from "./recent-activity";
import type {
  ImportedActivityPort,
  SyncLedgerPort,
  SyncSummary,
} from "./repository";
import type { IntervalsActivityDetail } from "./schemas";

export type Clock = {
  now: () => Date;
};

export type SyncWindow = {
  historyCoverage: "initial_30d_window" | "incremental_from_cursor";
  cursorStartUsed: Date;
};

export type NormalizedActivity = {
  detail: IntervalsActivityDetail;
  normalizedActivityType: string;
  startAt: Date;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number | null;
  distanceMeters: number;
};

export type IntervalsSyncPolicy = {
  initialWindowDays?: number;
  overlapHours?: number;
  detailConcurrency?: number;
  requestedStreamTypes?: readonly string[];
};

export type CreateIntervalsSyncModuleOptions = {
  accounts: IntervalsAccountPort;
  upstream: IntervalsUpstreamPort;
  ledger: SyncLedgerPort;
  activities: ImportedActivityPort;
  derived: DerivedPerformancePort;
  clock?: Clock;
  idGenerator?: () => string;
  policy?: IntervalsSyncPolicy;
};

export type IntervalsSyncApi = {
  syncNow: (userId: string) => Effect.Effect<SyncSummary, IntervalsSyncError>;
  latest: (
    userId: string,
  ) => Effect.Effect<SyncSummary | null, SyncPersistenceFailure>;
  recentActivities: (
    userId: string,
  ) => Effect.Effect<RecentActivityPreview[], SyncPersistenceFailure>;
  activityDetails: (
    userId: string,
    activityId: string,
  ) => Effect.Effect<ActivityDetailsPageData | null, SyncPersistenceFailure>;
};
