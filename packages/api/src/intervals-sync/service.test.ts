import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import type {
  ActivityAnalysisData,
  ActivitySummaryPageData,
} from "./activity-details";
import type { IntervalsAccountPort } from "../intervals/account";
import type { IntervalsUpstreamPort } from "./adapter";
import { InvalidIntervalsCredentials, SyncAlreadyInProgress } from "./errors";
import type { DerivedPerformancePort } from "./derived-performance-service";
import { createIntervalsSyncModule } from "./module";
import type { RecentActivityPreview } from "./recent-activity";
import type {
  ImportedActivityPort,
  SyncLedgerPort,
  SyncSummary,
  UpsertImportedActivityRecord,
} from "./repository";

function createAccountPort(
  overrides: Partial<IntervalsAccountPort> = {},
): IntervalsAccountPort {
  return {
    load: () =>
      Effect.succeed({
        username: "runner@example.com",
        apiKey: "intervals-secret",
        athleteId: null,
      }),
    saveResolvedAthlete: () => Effect.void,
    ...overrides,
  };
}

function createUpstreamPort(): IntervalsUpstreamPort {
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
    getDetail: async ({ activityId }) => ({
      id: activityId,
      icu_athlete_id: "i509216",
      type: "Run",
      start_date: "2026-03-20T00:00:00.000Z",
      moving_time: 1800,
      elapsed_time: 1820,
      distance: 5000,
    }),
    getMap: async () => ({
      latlngs: [
        [-27.47, 153.02],
        [-27.46, 153.03],
      ],
      route: {
        name: "River loop",
      },
    }),
    getStreams: async () => [
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

function createLedger(overrides: Partial<SyncLedgerPort> = {}): SyncLedgerPort {
  return {
    hasInProgress: () => Effect.succeed(false),
    begin: () => Effect.void,
    latest: () => Effect.succeed(null),
    latestSuccessfulCursor: () => Effect.succeed(null),
    completeSuccess: (input) =>
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
    completeFailure: (input) =>
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
    ...overrides,
  };
}

function createActivities(
  overrides: Partial<ImportedActivityPort> = {},
): ImportedActivityPort {
  return {
    upsert: () => Effect.succeed("inserted"),
    recentActivities: () => Effect.succeed([]),
    activitySummary: () => Effect.succeed(null),
    activityAnalysis: () => Effect.succeed(null),
    ...overrides,
  };
}

function createDerivedPort(
  overrides: Partial<DerivedPerformancePort> = {},
): DerivedPerformancePort {
  return {
    recompute: () =>
      Effect.succeed({
        effortCount: 0,
        warningCount: 0,
        allTimePrCount: 0,
        monthlyBestCount: 0,
      }),
    ...overrides,
  };
}

describe("intervals sync module", () => {
  it("rejects when a sync is already in progress", async () => {
    const service = createIntervalsSyncModule({
      accounts: createAccountPort(),
      ledger: createLedger({
        hasInProgress: () => Effect.succeed(true),
      }),
      activities: createActivities(),
      upstream: createUpstreamPort(),
      derived: createDerivedPort(),
      idGenerator: () => "event-1",
    });

    const exit = await Effect.runPromiseExit(service.syncNow("user-1"));

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
    let lastUpsert: UpsertImportedActivityRecord | undefined;

    const service = createIntervalsSyncModule({
      accounts: createAccountPort({
        saveResolvedAthlete: (_userId, identity) => {
          savedAthleteId = identity.athleteId;
          return Effect.void;
        },
      }),
      ledger: createLedger(),
      activities: createActivities({
        upsert: (record) => {
          lastUpsert = record;
          return Effect.succeed("inserted");
        },
      }),
      upstream: createUpstreamPort(),
      derived: createDerivedPort(),
      clock: {
        now: () => new Date("2026-03-21T00:00:00.000Z"),
      },
      idGenerator: () => "event-1",
    });

    const result = await Effect.runPromise(service.syncNow("user-1"));

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
    const service = createIntervalsSyncModule({
      accounts: createAccountPort(),
      ledger: createLedger(),
      activities: createActivities(),
      upstream: {
        ...createUpstreamPort(),
        getProfile: async () => {
          throw new InvalidIntervalsCredentials({
            message: "Intervals credentials were rejected",
          });
        },
      },
      derived: createDerivedPort(),
      idGenerator: () => "event-1",
    });

    const exit = await Effect.runPromiseExit(service.syncNow("user-1"));

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
    let lastUpsert: UpsertImportedActivityRecord | undefined;

    const service = createIntervalsSyncModule({
      accounts: createAccountPort(),
      ledger: createLedger(),
      activities: createActivities({
        upsert: (record) => {
          lastUpsert = record;
          return Effect.succeed("inserted");
        },
      }),
      upstream: {
        ...createUpstreamPort(),
        getMap: async () => null,
      },
      derived: createDerivedPort(),
      idGenerator: () => "event-1",
    });

    const result = await Effect.runPromise(service.syncNow("user-1"));

    expect(result.status).toBe("success");
    expect(result.failedMapCount).toBe(0);
    expect(result.storedMapCount).toBe(0);
    expect(lastUpsert?.map).toBeNull();
  });

  it("records map and stream failures independently while still importing the activity", async () => {
    const service = createIntervalsSyncModule({
      accounts: createAccountPort(),
      ledger: createLedger(),
      activities: createActivities(),
      upstream: {
        ...createUpstreamPort(),
        getMap: async () => {
          throw new Error("map unavailable");
        },
        getStreams: async () => {
          throw new Error("streams unavailable");
        },
      },
      derived: createDerivedPort(),
      idGenerator: () => "event-1",
    });

    const result = await Effect.runPromise(service.syncNow("user-1"));

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

  it("returns recent activities from the activities port unchanged", async () => {
    const recentActivities: RecentActivityPreview[] = [
      {
        id: "run-1",
        name: "Morning run",
        startDate: "2026-03-20T00:00:00.000Z",
        distance: 1000,
        elapsedTime: 1820,
        averageHeartrate: 154,
        routePreview: {
          latlngs: [
            [-27.47, 153.02],
            [-27.46, 153.03],
          ],
        },
      },
    ];

    const service = createIntervalsSyncModule({
      accounts: createAccountPort(),
      ledger: createLedger(),
      activities: createActivities({
        recentActivities: () => Effect.succeed(recentActivities),
      }),
      upstream: createUpstreamPort(),
      derived: createDerivedPort(),
      idGenerator: () => "event-1",
    });

    const result = await Effect.runPromise(service.recentActivities("user-1"));

    expect(result).toEqual(recentActivities);
  });

  it("returns the latest sync summary unchanged", async () => {
    const latestSummary: SyncSummary = {
      eventId: "event-1",
      status: "success",
      historyCoverage: "initial_30d_window",
      cursorStartUsed: "2026-03-01T00:00:00.000Z",
      coveredDateRange: {
        start: "2026-03-20T00:00:00.000Z",
        end: "2026-03-20T00:00:00.000Z",
      },
      newestImportedActivityStart: "2026-03-20T00:00:00.000Z",
      insertedCount: 1,
      updatedCount: 0,
      skippedNonRunningCount: 0,
      skippedInvalidCount: 0,
      failedDetailCount: 0,
      failedMapCount: 0,
      failedStreamCount: 0,
      storedMapCount: 1,
      storedStreamCount: 5,
      unknownActivityTypes: [],
      warnings: [],
      failedDetails: [],
      failureCategory: null,
      failureMessage: null,
      startedAt: "2026-03-21T00:00:00.000Z",
      completedAt: "2026-03-21T00:05:00.000Z",
    };

    const service = createIntervalsSyncModule({
      accounts: createAccountPort(),
      ledger: createLedger({
        latest: () => Effect.succeed(latestSummary),
      }),
      activities: createActivities(),
      upstream: createUpstreamPort(),
      derived: createDerivedPort(),
      idGenerator: () => "event-1",
    });

    const result = await Effect.runPromise(service.latest("user-1"));

    expect(result).toEqual(latestSummary);
  });

  it("returns activity summary from the activities port unchanged", async () => {
    const summary: ActivitySummaryPageData = {
      name: "Morning run",
      startDateLocal: "2026-03-20T10:00:00.000+10:00",
      type: "Run",
      deviceName: "Forerunner",
      mapPreview: null,
      distance: 1000,
      movingTime: 240,
      elapsedTime: 250,
      averageSpeed: 4.1,
      maxSpeed: 5.2,
      averageHeartrate: 152,
      maxHeartrate: 182,
      averageCadence: 84,
      calories: 100,
      totalElevationGain: 10,
      totalElevationLoss: 9,
      trainingLoad: 35,
      hrLoad: 40,
      intensity: 0.8,
      athleteMaxHr: 196,
      heartRateZonesBpm: [120, 140, 155],
      heartRateZoneDurationsSeconds: [120, 90, 30],
      oneKmSplitTimesSeconds: [
        {
          splitNumber: 1,
          splitDistanceMeters: 1000,
          durationSeconds: 240,
        },
      ],
      intervals: [],
      bestEfforts: [],
    };
    const analysis: ActivityAnalysisData = {
      heartrate: [],
      cadence: [],
      velocity_smooth: [],
      fixed_altitude: [],
    };

    const service = createIntervalsSyncModule({
      accounts: createAccountPort(),
      ledger: createLedger(),
      activities: createActivities({
        activitySummary: () => Effect.succeed(summary),
        activityAnalysis: () => Effect.succeed(analysis),
      }),
      upstream: createUpstreamPort(),
      derived: createDerivedPort(),
      idGenerator: () => "event-1",
    });

    const summaryResult = await Effect.runPromise(
      service.activitySummary("user-1", "run-1"),
    );
    const analysisResult = await Effect.runPromise(
      service.activityAnalysis("user-1", "run-1"),
    );

    expect(summaryResult).toEqual(summary);
    expect(analysisResult).toEqual(analysis);
  });
});
