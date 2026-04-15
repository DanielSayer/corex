import { Effect } from "effect";

import {
  classifyRunningActivityType,
  normalizeDetail,
} from "./activity-classification";
import {
  InvalidIntervalsCredentials,
  IntervalsSchemaValidationFailure,
  IntervalsUpstreamFailure,
  MissingIntervalsCredentials,
  SyncAlreadyInProgress,
  SyncPersistenceFailure,
} from "./errors";
import type {
  CreateIntervalsSyncModuleOptions,
  NormalizedActivity,
} from "./module-types";
import type { FailedDetailDiagnostic, SyncSummary } from "./repository-types";
import { computeSyncWindow, toIntervalsDate } from "./sync-policy";
import {
  createEndpointFailure,
  mapFailureCategory,
  validateRequestedStreams,
} from "./upstream-failures";
import type {
  IntervalsActivityDiscovery,
  IntervalsActivityMap,
  IntervalsActivityStream,
} from "./schemas";
import { isValidTimeZone } from "../goal-progress/timezones";

type RuntimeOptions = {
  clock: NonNullable<CreateIntervalsSyncModuleOptions["clock"]>;
  idGenerator: NonNullable<CreateIntervalsSyncModuleOptions["idGenerator"]>;
  initialWindowDays: number;
  overlapHours: number;
  detailConcurrency: number;
  requestedStreamTypes: string[];
};

type SyncCredentials = {
  username: string;
  apiKey: string;
};

type ResolvedAccount = {
  athleteId: string;
  credentials: SyncCredentials;
};

type DiscoveryResult = {
  discoveredActivities: IntervalsActivityDiscovery[];
  runningCandidates: IntervalsActivityDiscovery[];
  syncWindow: {
    historyCoverage: "initial_30d_window" | "incremental_from_cursor";
    cursorStartUsed: Date;
  };
  unknownActivityTypes: Set<string>;
};

type ImportedActivityResult = {
  insertedCount: number;
  updatedCount: number;
  skippedInvalidCount: number;
  failedDetailCount: number;
  failedMapCount: number;
  failedStreamCount: number;
  storedMapCount: number;
  storedStreamCount: number;
  failedDetails: FailedDetailDiagnostic[];
  importedStartDates: Date[];
};

function resolveAccountAndAthlete(
  options: CreateIntervalsSyncModuleOptions,
  runtime: RuntimeOptions,
  userId: string,
) {
  return Effect.gen(function* () {
    const account = yield* options.accounts.load(userId);
    const credentials = {
      username: account.username,
      apiKey: account.apiKey,
    };

    let athleteId = account.athleteId;

    if (!athleteId) {
      const profile = yield* Effect.tryPromise({
        try: () => options.upstream.getProfile({ credentials }),
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
      yield* options.accounts.saveResolvedAthlete(userId, {
        athleteId,
        resolvedAt: runtime.clock.now(),
        timezone:
          profile.timezone && isValidTimeZone(profile.timezone)
            ? profile.timezone
            : null,
      });
    }

    return {
      athleteId,
      credentials,
    } satisfies ResolvedAccount;
  });
}

function discoverActivities(
  options: CreateIntervalsSyncModuleOptions,
  runtime: RuntimeOptions,
  input: {
    userId: string;
    startedAt: Date;
    athleteId: string;
    credentials: SyncCredentials;
  },
) {
  return Effect.gen(function* () {
    const latestCursor = yield* options.ledger.latestSuccessfulCursor(
      input.userId,
    );
    const syncWindow = computeSyncWindow(
      input.startedAt,
      latestCursor,
      runtime.initialWindowDays,
      runtime.overlapHours,
    );

    const discoveredActivities = yield* Effect.tryPromise({
      try: () =>
        options.upstream.listActivities({
          credentials: input.credentials,
          athleteId: input.athleteId,
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

    return {
      discoveredActivities,
      runningCandidates,
      syncWindow,
      unknownActivityTypes,
    } satisfies DiscoveryResult;
  });
}

function buildDetailFailure(
  candidate: IntervalsActivityDiscovery,
  endpoint: FailedDetailDiagnostic["endpoint"],
  cause: unknown,
): FailedDetailDiagnostic {
  return {
    activityId: candidate.id,
    type: candidate.type,
    startDate: candidate.start_date ?? candidate.start_date_local ?? null,
    endpoint,
    message: cause instanceof Error ? cause.message : String(cause),
  };
}

function loadDetail(
  options: CreateIntervalsSyncModuleOptions,
  credentials: SyncCredentials,
  activity: IntervalsActivityDiscovery,
) {
  return Effect.either(
    Effect.tryPromise({
      try: () =>
        options.upstream.getDetail({
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
  );
}

function loadOptionalMap(
  options: CreateIntervalsSyncModuleOptions,
  credentials: SyncCredentials,
  candidate: IntervalsActivityDiscovery,
) {
  return Effect.either(
    Effect.tryPromise({
      try: () =>
        options.upstream.getMap({
          credentials,
          activityId: candidate.id,
        }),
      catch: (cause) => createEndpointFailure("map", candidate.id, cause),
    }),
  );
}

function loadOptionalStreams(
  options: CreateIntervalsSyncModuleOptions,
  runtime: RuntimeOptions,
  credentials: SyncCredentials,
  candidate: IntervalsActivityDiscovery,
) {
  return Effect.either(
    Effect.tryPromise({
      try: async () =>
        validateRequestedStreams(
          candidate.id,
          await options.upstream.getStreams({
            credentials,
            activityId: candidate.id,
            types: runtime.requestedStreamTypes,
          }),
          runtime.requestedStreamTypes,
        ),
      catch: (cause) => createEndpointFailure("streams", candidate.id, cause),
    }),
  );
}

function importNormalizedActivity(
  options: CreateIntervalsSyncModuleOptions,
  input: {
    userId: string;
    athleteId: string;
    normalized: NormalizedActivity;
    map: IntervalsActivityMap | null | undefined;
    streams: IntervalsActivityStream[] | undefined;
  },
) {
  return Effect.gen(function* () {
    const action = yield* options.activities.upsert({
      userId: input.userId,
      athleteId: input.athleteId,
      detail: input.normalized.detail,
      map: input.map,
      streams: input.streams,
      normalizedActivityType: input.normalized.normalizedActivityType,
      startAt: input.normalized.startAt,
      movingTimeSeconds: input.normalized.movingTimeSeconds,
      elapsedTimeSeconds: input.normalized.elapsedTimeSeconds,
      distanceMeters: input.normalized.distanceMeters,
    });

    yield* options.derived.recompute({
      userId: input.userId,
      upstreamActivityId: input.normalized.detail.id,
      normalizedActivityType: input.normalized.normalizedActivityType,
      startAt: input.normalized.startAt,
      movingTimeSeconds: input.normalized.movingTimeSeconds,
      distanceStream:
        input.streams?.find((stream) => stream.type === "distance") ?? null,
    });

    return action;
  });
}

function importActivities(
  options: CreateIntervalsSyncModuleOptions,
  runtime: RuntimeOptions,
  input: {
    userId: string;
    athleteId: string;
    credentials: SyncCredentials;
    runningCandidates: IntervalsActivityDiscovery[];
  },
) {
  return Effect.gen(function* () {
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
      input.runningCandidates,
      (activity) => loadDetail(options, input.credentials, activity),
      { concurrency: runtime.detailConcurrency },
    );

    for (let index = 0; index < detailResults.length; index += 1) {
      const result = detailResults[index];
      const candidate = input.runningCandidates[index];

      if (!candidate || !result) {
        continue;
      }

      if (result._tag === "Left") {
        failedDetailCount += 1;
        failedDetails.push(
          buildDetailFailure(candidate, "detail", result.left),
        );
        continue;
      }

      const normalized = normalizeDetail(result.right);

      if (!normalized) {
        skippedInvalidCount += 1;
        continue;
      }

      let map: IntervalsActivityMap | null | undefined = undefined;
      let streams: IntervalsActivityStream[] | undefined = undefined;

      const mapResult = yield* loadOptionalMap(
        options,
        input.credentials,
        candidate,
      );

      if (mapResult._tag === "Left") {
        failedMapCount += 1;
        failedDetails.push(
          buildDetailFailure(candidate, "map", mapResult.left),
        );
      } else {
        map = mapResult.right;

        if (map != null) {
          storedMapCount += 1;
        }
      }

      const streamsResult = yield* loadOptionalStreams(
        options,
        runtime,
        input.credentials,
        candidate,
      );

      if (streamsResult._tag === "Left") {
        failedStreamCount += 1;
        failedDetails.push(
          buildDetailFailure(candidate, "streams", streamsResult.left),
        );
      } else {
        streams = streamsResult.right;
        storedStreamCount += streams.length;
      }

      const action = yield* importNormalizedActivity(options, {
        userId: input.userId,
        athleteId: input.athleteId,
        normalized,
        map,
        streams,
      });

      importedStartDates.push(normalized.startAt);

      if (action === "inserted") {
        insertedCount += 1;
      } else {
        updatedCount += 1;
      }
    }

    return {
      insertedCount,
      updatedCount,
      skippedInvalidCount,
      failedDetailCount,
      failedMapCount,
      failedStreamCount,
      storedMapCount,
      storedStreamCount,
      failedDetails,
      importedStartDates,
    } satisfies ImportedActivityResult;
  });
}

function buildWarnings(input: {
  failedDetailCount: number;
  failedMapCount: number;
  failedStreamCount: number;
  skippedInvalidCount: number;
  unknownActivityTypes: Set<string>;
}) {
  const warnings: string[] = [];

  if (input.failedDetailCount > 0) {
    warnings.push(
      `${input.failedDetailCount} running activities could not be loaded from Intervals detail`,
    );
  }

  if (input.failedMapCount > 0) {
    warnings.push(
      `${input.failedMapCount} running activities could not be loaded from Intervals map`,
    );
  }

  if (input.failedStreamCount > 0) {
    warnings.push(
      `${input.failedStreamCount} running activities could not be loaded from Intervals streams`,
    );
  }

  if (input.skippedInvalidCount > 0) {
    warnings.push(
      `${input.skippedInvalidCount} running activities were skipped because required detail fields were missing`,
    );
  }

  if (input.unknownActivityTypes.size > 0) {
    warnings.push(
      `${input.unknownActivityTypes.size} unsupported activity types were skipped`,
    );
  }

  return warnings;
}

function finalizeSuccess(
  options: CreateIntervalsSyncModuleOptions,
  runtime: RuntimeOptions,
  input: {
    completed: ImportedActivityResult;
    discovered: DiscoveryResult;
    eventId: string;
  },
) {
  const coveredRangeStart =
    input.completed.importedStartDates.length > 0
      ? new Date(
          Math.min(
            ...input.completed.importedStartDates.map((value) =>
              value.getTime(),
            ),
          ),
        )
      : null;
  const coveredRangeEnd =
    input.completed.importedStartDates.length > 0
      ? new Date(
          Math.max(
            ...input.completed.importedStartDates.map((value) =>
              value.getTime(),
            ),
          ),
        )
      : null;

  return options.ledger.completeSuccess({
    eventId: input.eventId,
    historyCoverage: input.discovered.syncWindow.historyCoverage,
    cursorStartUsed: input.discovered.syncWindow.cursorStartUsed,
    coveredRangeStart,
    coveredRangeEnd,
    newestImportedActivityStart: coveredRangeEnd,
    insertedCount: input.completed.insertedCount,
    updatedCount: input.completed.updatedCount,
    skippedNonRunningCount:
      input.discovered.discoveredActivities.length -
      input.discovered.runningCandidates.length,
    skippedInvalidCount: input.completed.skippedInvalidCount,
    failedDetailCount: input.completed.failedDetailCount,
    failedMapCount: input.completed.failedMapCount,
    failedStreamCount: input.completed.failedStreamCount,
    storedMapCount: input.completed.storedMapCount,
    storedStreamCount: input.completed.storedStreamCount,
    unknownActivityTypes: [...input.discovered.unknownActivityTypes].sort(),
    warnings: buildWarnings({
      failedDetailCount: input.completed.failedDetailCount,
      failedMapCount: input.completed.failedMapCount,
      failedStreamCount: input.completed.failedStreamCount,
      skippedInvalidCount: input.completed.skippedInvalidCount,
      unknownActivityTypes: input.discovered.unknownActivityTypes,
    }),
    failedDetails: input.completed.failedDetails,
    completedAt: runtime.clock.now(),
  });
}

export function runIntervalsSyncNow(
  options: CreateIntervalsSyncModuleOptions,
  runtime: RuntimeOptions,
  userId: string,
): Effect.Effect<
  SyncSummary,
  | MissingIntervalsCredentials
  | InvalidIntervalsCredentials
  | IntervalsUpstreamFailure
  | IntervalsSchemaValidationFailure
  | SyncAlreadyInProgress
  | SyncPersistenceFailure
> {
  return Effect.gen(function* () {
    const hasInProgress = yield* options.ledger.hasInProgress(userId);

    if (hasInProgress) {
      return yield* Effect.fail(
        new SyncAlreadyInProgress({
          message: "A sync is already in progress",
        }),
      );
    }

    const startedAt = runtime.clock.now();
    const eventId = runtime.idGenerator();
    yield* options.ledger.begin(userId, {
      eventId,
      startedAt,
    });

    const finalizeFailure = (error: { message: string }) =>
      options.ledger.completeFailure({
        eventId,
        failureCategory: mapFailureCategory(error),
        failureMessage: error.message,
        completedAt: runtime.clock.now(),
      });

    const syncEffect = Effect.gen(function* () {
      const resolved = yield* resolveAccountAndAthlete(
        options,
        runtime,
        userId,
      );
      const discovered = yield* discoverActivities(options, runtime, {
        userId,
        startedAt,
        athleteId: resolved.athleteId,
        credentials: resolved.credentials,
      });
      const completed = yield* importActivities(options, runtime, {
        userId,
        athleteId: resolved.athleteId,
        credentials: resolved.credentials,
        runningCandidates: discovered.runningCandidates,
      });

      return yield* finalizeSuccess(options, runtime, {
        completed,
        discovered,
        eventId,
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
}
