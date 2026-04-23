import type { Effect } from "effect";

import type { SyncPersistenceFailure } from "./errors";
import type {
  RunBestEffortInput,
  RunProcessingWarning,
} from "./derived-performance";
import type { IntervalsActivityStream } from "../integrations/intervals-icu/schemas";

export type ImportedRunForDerivedPerformance = {
  userId: string;
  upstreamActivityId: string;
  normalizedActivityType: string;
  startAt: Date;
  movingTimeSeconds: number;
  distanceStream: IntervalsActivityStream | null;
};

export type DerivedPerformanceWriteSummary = {
  effortCount: number;
  warningCount: number;
  allTimePrCount: number;
  monthlyBestCount: number;
};

export type ReplaceRunEffortsInput = {
  userId: string;
  upstreamActivityId: string;
  startAt: Date;
  efforts: RunBestEffortInput[];
};

export type ReplaceRunWarningsInput = {
  userId: string;
  upstreamActivityId: string;
  warnings: RunProcessingWarning[];
};

export type DerivedPerformanceRepository = {
  replaceRunEfforts: (
    input: ReplaceRunEffortsInput,
  ) => Effect.Effect<DerivedPerformanceWriteSummary, SyncPersistenceFailure>;
  replaceRunWarnings: (
    input: ReplaceRunWarningsInput,
  ) => Effect.Effect<DerivedPerformanceWriteSummary, SyncPersistenceFailure>;
};

export type DerivedPerformanceCandidateRow = {
  userId: string;
  upstreamActivityId: string;
  distanceMeters: number;
  durationSeconds: number;
  startSampleIndex: number;
  endSampleIndex: number;
  startAt: Date;
};
