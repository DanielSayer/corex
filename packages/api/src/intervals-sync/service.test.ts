import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { createCredentialCrypto } from "../training-settings/crypto";
import type { StoredTrainingSettings } from "../training-settings/repository";
import {
  InvalidIntervalsCredentials,
  SyncAlreadyInProgress,
} from "./errors";
import type { IntervalsAdapter } from "./adapter";
import { createIntervalsSyncService } from "./service";
import type { IntervalsSyncRepository } from "./repository";

const masterKeyBase64 = Buffer.alloc(32, 7).toString("base64");

function createStoredSettings(): StoredTrainingSettings {
  return {
    userId: "user-1",
    goal: {
      type: "volume_goal",
      metric: "distance",
      period: "week",
      targetValue: 20,
      unit: "km",
    },
    availability: {
      monday: { available: true, maxDurationMinutes: 45 },
      tuesday: { available: false, maxDurationMinutes: null },
      wednesday: { available: true, maxDurationMinutes: 60 },
      thursday: { available: false, maxDurationMinutes: null },
      friday: { available: true, maxDurationMinutes: null },
      saturday: { available: true, maxDurationMinutes: 90 },
      sunday: { available: false, maxDurationMinutes: null },
    },
    intervalsCredential: {
      username: "runner@example.com",
      athleteId: null,
      athleteResolvedAt: null,
      ...Effect.runSync(
        createCredentialCrypto({
          masterKeyBase64,
          keyVersion: 1,
        }).encrypt("user-1", "intervals-secret"),
      ),
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    },
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    updatedAt: new Date("2026-03-20T00:00:00.000Z"),
  };
}

function createAdapter(): IntervalsAdapter {
  return {
    getProfile: async () => ({
      id: "i509216",
    }),
    listActivities: async () => [
      {
        id: "a-1",
        type: "Run",
        start_date: "2026-03-20T00:00:00.000Z",
      },
      {
        id: "a-2",
        type: "Ride",
        start_date: "2026-03-19T00:00:00.000Z",
      },
    ],
    getActivityDetail: async ({ activityId }) => ({
      id: activityId,
      icu_athlete_id: "i509216",
      type: "Run",
      start_date: "2026-03-20T00:00:00.000Z",
      moving_time: 1800,
      elapsed_time: 1820,
      distance: 5000,
    }),
  };
}

function createSyncRepo(
  overrides: Partial<IntervalsSyncRepository> = {},
): IntervalsSyncRepository {
  return {
    hasInProgressSync: () => Effect.succeed(false),
    createSyncEvent: () => Effect.void,
    upsertImportedActivity: () => Effect.succeed("inserted"),
    finalizeSyncSuccess: (input) =>
      Effect.succeed({
        eventId: input.eventId,
        status: "success",
        historyCoverage: input.historyCoverage,
        cursorStartUsed: input.cursorStartUsed.toISOString(),
        coveredDateRange: {
          start: input.coveredRangeStart?.toISOString() ?? null,
          end: input.coveredRangeEnd?.toISOString() ?? null,
        },
        newestImportedActivityStart:
          input.newestImportedActivityStart?.toISOString() ?? null,
        insertedCount: input.insertedCount,
        updatedCount: input.updatedCount,
        skippedNonRunningCount: input.skippedNonRunningCount,
        skippedInvalidCount: input.skippedInvalidCount,
        failedDetailCount: input.failedDetailCount,
        unknownActivityTypes: input.unknownActivityTypes,
        warnings: input.warnings,
        failedDetails: input.failedDetails,
        failureCategory: null,
        failureMessage: null,
        startedAt: new Date("2026-03-21T00:00:00.000Z").toISOString(),
        completedAt: input.completedAt.toISOString(),
      }),
    finalizeSyncFailure: (input) =>
      Effect.succeed({
        eventId: input.eventId,
        status: "failure",
        historyCoverage: null,
        cursorStartUsed: null,
        coveredDateRange: {
          start: null,
          end: null,
        },
        newestImportedActivityStart: null,
        insertedCount: 0,
        updatedCount: 0,
        skippedNonRunningCount: 0,
        skippedInvalidCount: 0,
        failedDetailCount: 0,
        unknownActivityTypes: [],
        warnings: [],
        failedDetails: [],
        failureCategory: input.failureCategory,
        failureMessage: input.failureMessage,
        startedAt: new Date("2026-03-21T00:00:00.000Z").toISOString(),
        completedAt: input.completedAt.toISOString(),
      }),
    getLatestSyncSummary: () => Effect.succeed(null),
    getLatestSuccessfulSyncCursor: () => Effect.succeed(null),
    ...overrides,
  };
}

describe("intervals sync service", () => {
  it("rejects when a sync is already in progress", async () => {
    const service = createIntervalsSyncService({
      trainingSettingsRepo: {
        findByUserId: () => Effect.succeed(createStoredSettings()),
        upsert: () => Effect.die("not used"),
        saveIntervalsAthleteIdentity: () => Effect.void,
      },
      syncRepo: createSyncRepo({
        hasInProgressSync: () => Effect.succeed(true),
      }),
      crypto: createCredentialCrypto({
        masterKeyBase64,
        keyVersion: 1,
      }),
      adapter: createAdapter(),
    });

    const exit = await Effect.runPromiseExit(service.triggerForUser("user-1"));

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(SyncAlreadyInProgress);
      }
    }
  });

  it("derives athlete identity, imports running activities, and reports skipped unsupported types", async () => {
    let savedAthleteId: string | undefined;

    const service = createIntervalsSyncService({
      trainingSettingsRepo: {
        findByUserId: () => Effect.succeed(createStoredSettings()),
        upsert: () => Effect.die("not used"),
        saveIntervalsAthleteIdentity: (_userId, identity) => {
          savedAthleteId = identity.athleteId;
          return Effect.void;
        },
      },
      syncRepo: createSyncRepo(),
      crypto: createCredentialCrypto({
        masterKeyBase64,
        keyVersion: 1,
      }),
      adapter: createAdapter(),
      clock: {
        now: () => new Date("2026-03-21T00:00:00.000Z"),
      },
    });

    const result = await Effect.runPromise(service.triggerForUser("user-1"));

    expect(savedAthleteId).toBe("i509216");
    expect(result.insertedCount).toBe(1);
    expect(result.skippedNonRunningCount).toBe(1);
    expect(result.unknownActivityTypes).toEqual(["Ride"]);
  });

  it("fails clearly when the initial Intervals identity lookup rejects credentials", async () => {
    const service = createIntervalsSyncService({
      trainingSettingsRepo: {
        findByUserId: () => Effect.succeed(createStoredSettings()),
        upsert: () => Effect.die("not used"),
        saveIntervalsAthleteIdentity: () => Effect.void,
      },
      syncRepo: createSyncRepo(),
      crypto: createCredentialCrypto({
        masterKeyBase64,
        keyVersion: 1,
      }),
      adapter: {
        ...createAdapter(),
        getProfile: async () => {
          throw new InvalidIntervalsCredentials({
            message: "Intervals credentials were rejected",
          });
        },
      },
    });

    const exit = await Effect.runPromiseExit(service.triggerForUser("user-1"));

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(InvalidIntervalsCredentials);
      }
    }
  });
});
