import { Effect } from "effect";

import type {
  DerivedPerformanceRepository,
  DerivedPerformanceWriteSummary,
  ImportedRunForDerivedPerformance,
} from "./derived-performance-repository";
import {
  computeBestEfforts,
  isMonotonicDistanceStream,
  normalizeDistanceStreamData,
  type RunProcessingWarning,
  validateDistanceStreamSampleCount,
} from "./derived-performance";
import type { SyncPersistenceFailure } from "./errors";

export type DerivedPerformanceService = ReturnType<
  typeof createDerivedPerformanceService
>;

export function createDerivedPerformanceService(options: {
  repo: DerivedPerformanceRepository;
}) {
  const processRun = (input: ImportedRunForDerivedPerformance) => {
    const distanceStream = input.distanceStream;

    if (!distanceStream) {
      const warning: RunProcessingWarning = {
        code: "missing_distance_stream",
        message:
          "This run does not have a distance stream, so best efforts could not be computed.",
        metadata: {},
      };

      return options.repo.replaceRunWarnings({
        userId: input.userId,
        upstreamActivityId: input.upstreamActivityId,
        warnings: [warning],
      });
    }

    const distanceSamples = normalizeDistanceStreamData(distanceStream.data);

    if (!distanceSamples || !isMonotonicDistanceStream(distanceSamples)) {
      const warning: RunProcessingWarning = {
        code: "invalid_distance_stream",
        message:
          "This run has an invalid distance stream, so best efforts could not be computed.",
        metadata: {
          streamType: distanceStream.type,
        },
      };

      return options.repo.replaceRunWarnings({
        userId: input.userId,
        upstreamActivityId: input.upstreamActivityId,
        warnings: [warning],
      });
    }

    if (
      !validateDistanceStreamSampleCount(
        distanceSamples.length,
        input.movingTimeSeconds,
      )
    ) {
      const warning: RunProcessingWarning = {
        code: "distance_stream_cadence_mismatch",
        message:
          "This run was recorded with a distance stream cadence that is not compatible with best-effort calculations.",
        metadata: {
          movingTimeSeconds: input.movingTimeSeconds,
          sampleCount: distanceSamples.length,
        },
      };

      return options.repo.replaceRunWarnings({
        userId: input.userId,
        upstreamActivityId: input.upstreamActivityId,
        warnings: [warning],
      });
    }

    return options.repo.replaceRunEfforts({
      userId: input.userId,
      upstreamActivityId: input.upstreamActivityId,
      startAt: input.startAt,
      efforts: computeBestEfforts(distanceSamples),
    });
  };

  return {
    recomputeRunEffortsForImportedRun(
      input: ImportedRunForDerivedPerformance,
    ): Effect.Effect<DerivedPerformanceWriteSummary, SyncPersistenceFailure> {
      return processRun(input);
    },
    deleteRunDerivedPerformance(input: {
      userId: string;
      upstreamActivityId: string;
      warnings: RunProcessingWarning[];
    }): Effect.Effect<DerivedPerformanceWriteSummary, SyncPersistenceFailure> {
      return options.repo.replaceRunWarnings(input);
    },
  };
}
