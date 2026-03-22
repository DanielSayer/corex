import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import type { IntervalsAccountService } from "../intervals/account";
import type { IntervalsAdapter } from "./adapter";
import {
  InvalidIntervalsCredentials,
  IntervalsSchemaValidationFailure,
  IntervalsUpstreamFailure,
  SyncAlreadyInProgress,
  SyncPersistenceFailure,
  MissingIntervalsCredentials,
} from "./errors";
import type {
  FailedDetailDiagnostic,
  IntervalsSyncRepository,
  SyncSummary,
} from "./repository";
import type {
  IntervalsActivityDetail,
  IntervalsActivityDiscovery,
  IntervalsActivityMap,
  IntervalsActivityStream,
} from "./schemas";

const RUNNING_ACTIVITY_TYPES = new Set([
  "Run",
  "TrailRun",
  "TreadmillRun",
  "VirtualRun",
]);

const DEFAULT_INITIAL_WINDOW_DAYS = 30;
const DEFAULT_INCREMENTAL_OVERLAP_HOURS = 24;
const DEFAULT_DETAIL_CONCURRENCY = 4;
export const REQUESTED_STREAM_TYPES = [
  "cadence",
  "heartrate",
  "distance",
  "velocity_smooth",
  "fixed_altitude",
] as const;

type Clock = {
  now: () => Date;
};

type CreateIntervalsSyncServiceOptions = {
  account: IntervalsAccountService;
  syncRepo: IntervalsSyncRepository;
  adapter: IntervalsAdapter;
  clock?: Clock;
  initialWindowDays?: number;
  incrementalOverlapHours?: number;
  detailConcurrency?: number;
};

type SyncWindow = {
  historyCoverage: "initial_30d_window" | "incremental_from_cursor";
  cursorStartUsed: Date;
};

type NormalizedActivity = {
  detail: IntervalsActivityDetail;
  normalizedActivityType: string;
  startAt: Date;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number | null;
  distanceMeters: number;
};

function computeSyncWindow(
  now: Date,
  latestCursor: Date | null,
  initialWindowDays: number,
  overlapHours: number,
): SyncWindow {
  if (!latestCursor) {
    const cursorStartUsed = new Date(now);
    cursorStartUsed.setUTCDate(
      cursorStartUsed.getUTCDate() - initialWindowDays,
    );

    return {
      historyCoverage: "initial_30d_window",
      cursorStartUsed,
    };
  }

  const cursorStartUsed = new Date(latestCursor);
  cursorStartUsed.setUTCHours(cursorStartUsed.getUTCHours() - overlapHours);

  return {
    historyCoverage: "incremental_from_cursor",
    cursorStartUsed,
  };
}

function toIntervalsDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function classifyRunningActivityType(
  type: string | null | undefined,
): string | null {
  if (!type) {
    return null;
  }

  return RUNNING_ACTIVITY_TYPES.has(type) ? type : null;
}

function normalizeDetail(
  detail: IntervalsActivityDetail,
): NormalizedActivity | null {
  const normalizedActivityType = classifyRunningActivityType(detail.type);

  if (
    !normalizedActivityType ||
    !detail.start_date ||
    detail.moving_time == null ||
    detail.distance == null
  ) {
    return null;
  }

  const startAt = new Date(detail.start_date);

  if (Number.isNaN(startAt.getTime())) {
    return null;
  }

  return {
    detail,
    normalizedActivityType,
    startAt,
    movingTimeSeconds: Math.round(detail.moving_time),
    elapsedTimeSeconds:
      detail.elapsed_time == null ? null : Math.round(detail.elapsed_time),
    distanceMeters: detail.distance,
  };
}

function mapFailureCategory(error: unknown): string {
  if (error instanceof MissingIntervalsCredentials) {
    return "missing_credentials";
  }

  if (error instanceof InvalidIntervalsCredentials) {
    return "invalid_credentials";
  }

  if (error instanceof IntervalsUpstreamFailure) {
    return "upstream_request_failure";
  }

  if (error instanceof IntervalsSchemaValidationFailure) {
    return "upstream_schema_validation_failure";
  }

  if (error instanceof SyncAlreadyInProgress) {
    return "sync_already_in_progress";
  }

  return "persistence_failure";
}

function createEndpointFailure(
  endpoint: "map" | "streams",
  activityId: string,
  cause: unknown,
) {
  if (
    cause instanceof InvalidIntervalsCredentials ||
    cause instanceof IntervalsUpstreamFailure ||
    cause instanceof IntervalsSchemaValidationFailure
  ) {
    return cause;
  }

  return new IntervalsUpstreamFailure({
    message: `Failed to load Intervals activity ${endpoint} for ${activityId}`,
    endpoint: `${endpoint}:${activityId}`,
    cause,
  });
}

function validateRequestedStreams(
  activityId: string,
  streams: IntervalsActivityStream[],
): IntervalsActivityStream[] {
  const received = new Set(streams.map((stream) => stream.type));

  for (const type of REQUESTED_STREAM_TYPES) {
    if (!received.has(type)) {
      throw new IntervalsSchemaValidationFailure({
        message: `Intervals streams payload for ${activityId} was missing required stream ${type}`,
        endpoint: `streams:${activityId}`,
      });
    }
  }

  return streams.filter((stream) =>
    REQUESTED_STREAM_TYPES.includes(
      stream.type as (typeof REQUESTED_STREAM_TYPES)[number],
    ),
  );
}

export function createIntervalsSyncService(
  options: CreateIntervalsSyncServiceOptions,
) {
  const clock = options.clock ?? { now: () => new Date() };
  const initialWindowDays =
    options.initialWindowDays ?? DEFAULT_INITIAL_WINDOW_DAYS;
  const overlapHours =
    options.incrementalOverlapHours ?? DEFAULT_INCREMENTAL_OVERLAP_HOURS;
  const detailConcurrency =
    options.detailConcurrency ?? DEFAULT_DETAIL_CONCURRENCY;

  return {
    latestForUser(userId: string): Effect.Effect<SyncSummary | null, unknown> {
      return Effect.mapError(
        options.syncRepo.getLatestSyncSummary(userId),
        (cause) => cause,
      );
    },
    triggerForUser(userId: string): Effect.Effect<SyncSummary, unknown> {
      return Effect.gen(function* () {
        const hasInProgress = yield* options.syncRepo.hasInProgressSync(userId);

        if (hasInProgress) {
          return yield* Effect.fail(
            new SyncAlreadyInProgress({
              message: "A sync is already in progress",
            }),
          );
        }

        const startedAt = clock.now();
        const eventId = randomUUID();
        yield* options.syncRepo.createSyncEvent(userId, {
          id: eventId,
          startedAt,
        });

        const finalizeFailure = (error: { message: string }) =>
          options.syncRepo.finalizeSyncFailure({
            eventId,
            failureCategory: mapFailureCategory(error),
            failureMessage: error.message,
            completedAt: clock.now(),
          });

        const syncEffect = Effect.gen(function* () {
          const account = yield* options.account.loadAccountForUser(userId);
          const credentials = {
            username: account.username,
            apiKey: account.apiKey,
          };

          let athleteId = account.athleteId;

          if (!athleteId) {
            const profile = yield* Effect.tryPromise({
              try: () => options.adapter.getProfile(credentials),
              catch: (cause) =>
                cause instanceof InvalidIntervalsCredentials ||
                cause instanceof IntervalsUpstreamFailure ||
                cause instanceof IntervalsSchemaValidationFailure
                  ? cause
                  : new IntervalsUpstreamFailure({
                      message: "Failed to load Intervals athlete profile",
                      endpoint: "profile",
                      cause,
                    }),
            });

            athleteId = profile.id;
            yield* options.account.recordResolvedAthleteIdentity(userId, {
              athleteId,
              resolvedAt: clock.now(),
            });
          }

          const latestCursor =
            yield* options.syncRepo.getLatestSuccessfulSyncCursor(userId);
          const syncWindow = computeSyncWindow(
            startedAt,
            latestCursor,
            initialWindowDays,
            overlapHours,
          );

          const discoveredActivities = yield* Effect.tryPromise({
            try: () =>
              options.adapter.listActivities({
                credentials,
                athleteId,
                oldest: toIntervalsDate(syncWindow.cursorStartUsed),
              }),
            catch: (cause) =>
              cause instanceof InvalidIntervalsCredentials ||
              cause instanceof IntervalsUpstreamFailure ||
              cause instanceof IntervalsSchemaValidationFailure
                ? cause
                : new IntervalsUpstreamFailure({
                    message: "Failed to load Intervals activities",
                    endpoint: "activities",
                    cause,
                  }),
          });

          const unknownActivityTypes = new Set<string>();
          const runningCandidates: IntervalsActivityDiscovery[] = [];

          for (const activity of discoveredActivities) {
            const normalizedType = classifyRunningActivityType(activity.type);

            if (!normalizedType) {
              unknownActivityTypes.add(activity.type);
              continue;
            }

            runningCandidates.push(activity);
          }

          let insertedCount = 0;
          let updatedCount = 0;
          let skippedInvalidCount = 0;
          let failedDetailCount = 0;
          let failedMapCount = 0;
          let failedStreamCount = 0;
          let storedMapCount = 0;
          let storedStreamCount = 0;
          const failedDetails: FailedDetailDiagnostic[] = [];
          const importedStartDates: Date[] = [];

          const detailResults = yield* Effect.forEach(
            runningCandidates,
            (activity) =>
              Effect.either(
                Effect.tryPromise({
                  try: () =>
                    options.adapter.getActivityDetail({
                      credentials,
                      activityId: activity.id,
                    }),
                  catch: (cause) =>
                    cause instanceof InvalidIntervalsCredentials ||
                    cause instanceof IntervalsUpstreamFailure ||
                    cause instanceof IntervalsSchemaValidationFailure
                      ? cause
                      : new IntervalsUpstreamFailure({
                          message: `Failed to load Intervals activity detail for ${activity.id}`,
                          endpoint: `activity:${activity.id}`,
                          cause,
                        }),
                }),
              ),
            { concurrency: detailConcurrency },
          );

          for (let index = 0; index < detailResults.length; index += 1) {
            const result = detailResults[index];
            const candidate = runningCandidates[index];

            if (!candidate || !result) {
              continue;
            }

            if (result._tag === "Left") {
              failedDetailCount += 1;
              failedDetails.push({
                activityId: candidate.id,
                type: candidate.type,
                startDate:
                  candidate.start_date ?? candidate.start_date_local ?? null,
                endpoint: "detail",
                message:
                  result.left instanceof Error
                    ? result.left.message
                    : String(result.left),
              });
              continue;
            }

            const normalized = normalizeDetail(
              result.right as IntervalsActivityDetail,
            );

            if (!normalized) {
              skippedInvalidCount += 1;
              continue;
            }

            let map: IntervalsActivityMap | null | undefined = undefined;
            let streams: IntervalsActivityStream[] | undefined = undefined;

            const mapResult = yield* Effect.either(
              Effect.tryPromise({
                try: () =>
                  options.adapter.getActivityMap({
                    credentials,
                    activityId: candidate.id,
                  }),
                catch: (cause) => createEndpointFailure("map", candidate.id, cause),
              }),
            );

            if (mapResult._tag === "Left") {
              failedMapCount += 1;
              failedDetails.push({
                activityId: candidate.id,
                type: candidate.type,
                startDate:
                  candidate.start_date ?? candidate.start_date_local ?? null,
                endpoint: "map",
                message:
                  mapResult.left instanceof Error
                    ? mapResult.left.message
                    : String(mapResult.left),
              });
            } else {
              map = mapResult.right;

              if (map != null) {
                storedMapCount += 1;
              }
            }

            const streamsResult = yield* Effect.either(
              Effect.tryPromise({
                try: async () =>
                  validateRequestedStreams(
                    candidate.id,
                    await options.adapter.getActivityStreams({
                      credentials,
                      activityId: candidate.id,
                      types: [...REQUESTED_STREAM_TYPES],
                    }),
                  ),
                catch: (cause) =>
                  createEndpointFailure("streams", candidate.id, cause),
              }),
            );

            if (streamsResult._tag === "Left") {
              failedStreamCount += 1;
              failedDetails.push({
                activityId: candidate.id,
                type: candidate.type,
                startDate:
                  candidate.start_date ?? candidate.start_date_local ?? null,
                endpoint: "streams",
                message:
                  streamsResult.left instanceof Error
                    ? streamsResult.left.message
                    : String(streamsResult.left),
              });
            } else {
              streams = streamsResult.right;
              storedStreamCount += streams.length;
            }

            const action = yield* options.syncRepo.upsertImportedActivity({
              userId,
              athleteId,
              detail: normalized.detail,
              map,
              streams,
              normalizedActivityType: normalized.normalizedActivityType,
              startAt: normalized.startAt,
              movingTimeSeconds: normalized.movingTimeSeconds,
              elapsedTimeSeconds: normalized.elapsedTimeSeconds,
              distanceMeters: normalized.distanceMeters,
            });

            importedStartDates.push(normalized.startAt);

            if (action === "inserted") {
              insertedCount += 1;
            } else {
              updatedCount += 1;
            }
          }

          const warnings: string[] = [];

          if (failedDetailCount > 0) {
            warnings.push(
              `${failedDetailCount} running activities could not be loaded from Intervals detail`,
            );
          }

          if (failedMapCount > 0) {
            warnings.push(
              `${failedMapCount} running activities could not be loaded from Intervals map`,
            );
          }

          if (failedStreamCount > 0) {
            warnings.push(
              `${failedStreamCount} running activities could not be loaded from Intervals streams`,
            );
          }

          if (skippedInvalidCount > 0) {
            warnings.push(
              `${skippedInvalidCount} running activities were skipped because required detail fields were missing`,
            );
          }

          if (unknownActivityTypes.size > 0) {
            warnings.push(
              `${unknownActivityTypes.size} unsupported activity types were skipped`,
            );
          }

          const coveredRangeStart =
            importedStartDates.length > 0
              ? new Date(
                  Math.min(
                    ...importedStartDates.map((value) => value.getTime()),
                  ),
                )
              : null;
          const coveredRangeEnd =
            importedStartDates.length > 0
              ? new Date(
                  Math.max(
                    ...importedStartDates.map((value) => value.getTime()),
                  ),
                )
              : null;
          const newestImportedActivityStart = coveredRangeEnd;

          return yield* options.syncRepo.finalizeSyncSuccess({
            eventId,
            historyCoverage: syncWindow.historyCoverage,
            cursorStartUsed: syncWindow.cursorStartUsed,
            coveredRangeStart,
            coveredRangeEnd,
            newestImportedActivityStart,
            insertedCount,
            updatedCount,
            skippedNonRunningCount:
              discoveredActivities.length - runningCandidates.length,
            skippedInvalidCount,
            failedDetailCount,
            failedMapCount,
            failedStreamCount,
            storedMapCount,
            storedStreamCount,
            unknownActivityTypes: [...unknownActivityTypes].sort(),
            warnings,
            failedDetails,
            completedAt: clock.now(),
          });
        });

        return yield* Effect.catchAll(syncEffect, (error) =>
          Effect.gen(function* () {
            const failure =
              error instanceof MissingIntervalsCredentials ||
              error instanceof InvalidIntervalsCredentials ||
              error instanceof IntervalsUpstreamFailure ||
              error instanceof IntervalsSchemaValidationFailure ||
              error instanceof SyncAlreadyInProgress ||
              error instanceof SyncPersistenceFailure
                ? error
                : new IntervalsUpstreamFailure({
                    message: "Unexpected Intervals sync failure",
                    endpoint: "sync",
                    cause: error,
                  });

            yield* finalizeFailure(failure);
            return yield* Effect.fail(failure);
          }),
        );
      });
    },
  };
}

export type IntervalsSyncService = ReturnType<
  typeof createIntervalsSyncService
>;
