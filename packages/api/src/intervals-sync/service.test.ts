import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { InvalidIntervalsCredentials, SyncAlreadyInProgress } from "./errors";
import type { IntervalsAdapter } from "./adapter";
import { createIntervalsSyncService } from "./service";
import type { IntervalsAccountService } from "../intervals/account";
import type { IntervalsSyncRepository } from "./repository";

function createAccountService(
  overrides: Partial<IntervalsAccountService> = {},
): IntervalsAccountService {
  return {
    loadAccountForUser: () =>
      Effect.succeed({
        username: "runner@example.com",
        apiKey: "intervals-secret",
        athleteId: null,
      }),
    recordResolvedAthleteIdentity: () => Effect.void,
    ...overrides,
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
    getActivityMap: async () => ({
      latlngs: [
        [-27.47, 153.02],
        [-27.46, 153.03],
      ],
      route: {
        name: "River loop",
      },
    }),
    getActivityStreams: async () => [
      {
        type: "cadence",
        data: [82, 83, 84],
      },
      {
        type: "heartrate",
        data: [118, 121, 125],
      },
      {
        type: "distance",
        data: [0, 1000, 2000],
      },
      {
        type: "velocity_smooth",
        data: [3.4, 3.5, 3.6],
      },
      {
        type: "fixed_altitude",
        data: [10, 11, 12],
      },
    ],
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
        failedMapCount: input.failedMapCount,
        failedStreamCount: input.failedStreamCount,
        storedMapCount: input.storedMapCount,
        storedStreamCount: input.storedStreamCount,
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
        failedMapCount: 0,
        failedStreamCount: 0,
        storedMapCount: 0,
        storedStreamCount: 0,
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
      account: createAccountService(),
      syncRepo: createSyncRepo({
        hasInProgressSync: () => Effect.succeed(true),
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
    let lastUpsert:
      | Parameters<IntervalsSyncRepository["upsertImportedActivity"]>[0]
      | undefined;

    const service = createIntervalsSyncService({
      account: createAccountService({
        recordResolvedAthleteIdentity: (_userId, identity) => {
          savedAthleteId = identity.athleteId;
          return Effect.void;
        },
      }),
      syncRepo: createSyncRepo({
        upsertImportedActivity: (record) => {
          lastUpsert = record;
          return Effect.succeed("inserted");
        },
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
    expect(result.storedMapCount).toBe(1);
    expect(result.storedStreamCount).toBe(5);
    expect(lastUpsert?.map).toMatchObject({
      route: { name: "River loop" },
    });
    expect(lastUpsert?.streams).toHaveLength(5);
  });

  it("fails clearly when the initial Intervals identity lookup rejects credentials", async () => {
    const service = createIntervalsSyncService({
      account: createAccountService(),
      syncRepo: createSyncRepo(),
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

  it("treats null maps as expected absence and does not count them as failures", async () => {
    let lastUpsert:
      | Parameters<IntervalsSyncRepository["upsertImportedActivity"]>[0]
      | undefined;

    const service = createIntervalsSyncService({
      account: createAccountService(),
      syncRepo: createSyncRepo({
        upsertImportedActivity: (record) => {
          lastUpsert = record;
          return Effect.succeed("inserted");
        },
      }),
      adapter: {
        ...createAdapter(),
        getActivityMap: async () => null,
      },
    });

    const result = await Effect.runPromise(service.triggerForUser("user-1"));

    expect(result.status).toBe("success");
    expect(result.failedMapCount).toBe(0);
    expect(result.storedMapCount).toBe(0);
    expect(lastUpsert?.map).toBeNull();
  });

  it("records map and stream failures independently while still importing the activity", async () => {
    const service = createIntervalsSyncService({
      account: createAccountService(),
      syncRepo: createSyncRepo(),
      adapter: {
        ...createAdapter(),
        getActivityMap: async () => {
          throw new Error("map unavailable");
        },
        getActivityStreams: async () => {
          throw new Error("streams unavailable");
        },
      },
    });

    const result = await Effect.runPromise(service.triggerForUser("user-1"));

    expect(result.status).toBe("success");
    expect(result.insertedCount).toBe(1);
    expect(result.failedMapCount).toBe(1);
    expect(result.failedStreamCount).toBe(1);
    expect(result.failedDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          activityId: "a-1",
          endpoint: "map",
        }),
        expect.objectContaining({
          activityId: "a-1",
          endpoint: "streams",
        }),
      ]),
    );
  });
});
