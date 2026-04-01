import { beforeEach, describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createIntervalsAdapter } from "@corex/api/intervals-sync/adapter";
import type { IntervalsAdapter } from "@corex/api/intervals-sync/adapter";
import { createLiveIntervalsSyncApi } from "@corex/api/intervals-sync/live";
import { createSyncLedgerPort } from "@corex/api/intervals-sync/repository";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";

import { getIntegrationHarness, resetDatabase } from "./harness";

const masterKeyBase64 = Buffer.alloc(32, 9).toString("base64");

function createAdapter(
  overrides: Partial<IntervalsAdapter> = {},
): IntervalsAdapter {
  const distanceData = Array.from({ length: 2401 }, (_, index) => index * 4);

  return {
    getProfile: async () => ({
      id: "i509216",
      email: "runner@example.com",
    }),
    listActivities: async () => [
      {
        id: "run-1",
        type: "Run",
        start_date: "2026-03-20T00:00:00.000Z",
      },
      {
        id: "ride-1",
        type: "Ride",
        start_date: "2026-03-19T00:00:00.000Z",
      },
    ],
    getActivityDetail: async ({ activityId }) => ({
      id: activityId,
      icu_athlete_id: "i509216",
      type: "Run",
      name: "Morning run",
      start_date: "2026-03-20T00:00:00.000Z",
      start_date_local: "2026-03-20T10:00:00.000+10:00",
      moving_time: 2400,
      elapsed_time: 2450,
      distance: 8000,
      max_speed: 5.1,
      average_heartrate: 152,
      max_heartrate: 180,
      average_cadence: 84,
      calories: 640,
      device_name: "Forerunner 265",
      total_elevation_gain: 42,
      total_elevation_loss: 39,
      icu_training_load: 77,
      hr_load: 88,
      icu_intensity: 0.83,
      athlete_max_hr: 196,
      icu_hr_zones: [120, 140, 155, 170, 182],
      icu_hr_zone_times: [120, 360, 840, 720, 360],
      icu_intervals: [
        {
          id: 1,
          type: "WARMUP",
          zone: 2,
          intensity: 1,
          distance: 1000,
          moving_time: 300,
          elapsed_time: 305,
          start_time: 0,
          end_time: 300,
          average_speed: 3.33,
          max_speed: 4.4,
          average_heartrate: 132,
          max_heartrate: 145,
          average_cadence: 82,
          average_stride: 1.03,
          total_elevation_gain: 5,
        },
      ],
    }),
    getActivityMap: async () => ({
      latlngs: [
        [-27.4748, 153.0192],
        [-27.4734, 153.0211],
      ],
      route: {
        name: "River loop",
      },
      weather: {
        points: [],
        closest_points: [],
      },
    }),
    getActivityStreams: async () => [
      {
        type: "cadence",
        data: distanceData.map(() => 82),
        allNull: false,
      },
      {
        type: "heartrate",
        data: distanceData.map(() => 150),
      },
      {
        type: "distance",
        data: distanceData,
      },
      {
        type: "velocity_smooth",
        data: distanceData.map(() => 4),
      },
      {
        type: "fixed_altitude",
        data: distanceData.map(() => 11),
      },
    ],
    ...overrides,
  };
}

async function createConfiguredSyncService(adapter: IntervalsAdapter) {
  const { db } = await getIntegrationHarness();

  return createLiveIntervalsSyncApi({
    db,
    env: {
      SETTINGS_MASTER_KEY_BASE64: masterKeyBase64,
    },
    adapter,
    clock: {
      now: () => new Date("2026-03-21T00:00:00.000Z"),
    },
  });
}

async function createConfiguredTrainingSettingsService() {
  const { db } = await getIntegrationHarness();

  return createTrainingSettingsService({
    repo: createTrainingSettingsRepository(db),
    crypto: createCredentialCrypto({
      masterKeyBase64,
      keyVersion: 1,
    }),
  });
}

describe("intervals sync integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  }, 15_000);

  it("resolves athlete identity, imports local activity history, and records a sync summary", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    const service = await createConfiguredSyncService(createAdapter());
    const result = await Effect.runPromise(service.syncNow(user.id));
    const importedRows = await db.query.importedActivity.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const importedMapRows = await db.query.importedActivityMap.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const importedStreamRows = await db.query.importedActivityStream.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const heartRateZoneRows =
      await db.query.importedActivityHeartRateZone.findMany({
        where: (table, { eq }) => eq(table.userId, user.id),
      });
    const intervalRows = await db.query.importedActivityInterval.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const runBestEffortRows = await db.query.runBestEffort.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const allTimePrRows = await db.query.userAllTimePr.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const monthlyBestRows = await db.query.userMonthlyBest.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const warningRows = await db.query.runProcessingWarning.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const storedSettings = await Effect.runPromise(
      createTrainingSettingsRepository(db).findByUserId(user.id),
    );

    expect(result.status).toBe("success");
    expect(result.insertedCount).toBe(1);
    expect(result.skippedNonRunningCount).toBe(1);
    expect(result.unknownActivityTypes).toEqual(["Ride"]);
    expect(importedRows).toHaveLength(1);
    expect(importedMapRows).toHaveLength(1);
    expect(importedStreamRows).toHaveLength(5);
    expect(heartRateZoneRows).toHaveLength(5);
    expect(intervalRows).toHaveLength(1);
    expect(runBestEffortRows.length).toBeGreaterThan(0);
    expect(allTimePrRows.length).toBeGreaterThan(0);
    expect(monthlyBestRows.length).toBeGreaterThan(0);
    expect(warningRows).toHaveLength(0);
    expect(result.storedMapCount).toBe(1);
    expect(result.storedStreamCount).toBe(5);
    expect(importedRows[0]?.rawDetail).toMatchObject({
      id: "run-1",
      distance: 8000,
      average_cadence: 84,
    });
    expect(importedRows[0]).toMatchObject({
      name: "Morning run",
      deviceName: "Forerunner 265",
      maxSpeedMetersPerSecond: 5.1,
      maxHeartrate: 180,
      averageCadence: 168,
      calories: 640,
      totalElevationGainMeters: 42,
      totalElevationLossMeters: 39,
      trainingLoad: 77,
      hrLoad: 88,
      intensity: 0.83,
      athleteMaxHr: 196,
    });
    expect(
      importedStreamRows.find((row) => row.streamType === "cadence")?.rawStream,
    ).toMatchObject({
      type: "cadence",
      data: expect.arrayContaining([164]),
    });
    expect(importedMapRows[0]?.rawMap).toMatchObject({
      route: { name: "River loop" },
    });
    expect(importedStreamRows[0]?.rawStream).toBeTruthy();
    expect(storedSettings?.intervalsCredential.athleteId).toBe("i509216");
    expect(allTimePrRows.some((row) => row.distanceMeters === 400)).toBe(true);
    expect(monthlyBestRows.some((row) => row.distanceMeters === 400)).toBe(
      true,
    );
  });

  it("runs through the live Intervals boundary without constructing training-settings internals in the caller", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    const service = await createConfiguredSyncService(createAdapter());
    const result = await Effect.runPromise(service.syncNow(user.id));
    const latest = await Effect.runPromise(
      createSyncLedgerPort(db).latest(user.id),
    );

    expect(result.status).toBe("success");
    expect(latest?.status).toBe("success");
    expect(latest?.insertedCount).toBe(1);
    expect(latest?.storedMapCount).toBe(1);
    expect(latest?.storedStreamCount).toBe(5);
  });

  it("records a failure when Intervals credentials are invalid", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    const service = await createConfiguredSyncService(
      createAdapter({
        getProfile: async () => {
          throw new Error("401");
        },
      }),
    );

    const exit = await Effect.runPromiseExit(service.syncNow(user.id));

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);
    }

    const latest = await Effect.runPromise(
      createSyncLedgerPort(db).latest(user.id),
    );

    expect(latest?.status).toBe("failure");
    expect(latest?.failureCategory).toBe("upstream_request_failure");
  });

  it("keeps sync successful when one activity detail fetch fails and records diagnostics", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    const service = await createConfiguredSyncService(
      createAdapter({
        listActivities: async () => [
          {
            id: "run-1",
            type: "Run",
            start_date: "2026-03-20T00:00:00.000Z",
          },
          {
            id: "run-2",
            type: "Run",
            start_date: "2026-03-19T00:00:00.000Z",
          },
        ],
        getActivityDetail: async ({ activityId }) => {
          if (activityId === "run-2") {
            throw new Error("detail unavailable");
          }

          return {
            id: activityId,
            icu_athlete_id: "i509216",
            type: "Run",
            start_date: "2026-03-20T00:00:00.000Z",
            moving_time: 2400,
            elapsed_time: 2450,
            distance: 8000,
          };
        },
      }),
    );

    const result = await Effect.runPromise(service.syncNow(user.id));

    expect(result.status).toBe("success");
    expect(result.insertedCount).toBe(1);
    expect(result.failedDetailCount).toBe(1);
    expect(result.failedDetails[0]).toMatchObject({
      activityId: "run-2",
      type: "Run",
    });
    expect(result.warnings[0]).toContain(
      "1 running activities could not be loaded",
    );
  });

  it("stores activities and streams without a map row when map data is absent", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    const service = await createConfiguredSyncService(
      createAdapter({
        getActivityMap: async () => null,
      }),
    );

    const result = await Effect.runPromise(service.syncNow(user.id));
    const importedMapRows = await db.query.importedActivityMap.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const importedStreamRows = await db.query.importedActivityStream.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(result.status).toBe("success");
    expect(result.failedMapCount).toBe(0);
    expect(result.storedMapCount).toBe(0);
    expect(importedMapRows).toHaveLength(0);
    expect(importedStreamRows).toHaveLength(5);
  });

  it("keeps sync successful when map or streams fetch fails and records enrichment diagnostics", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    const service = await createConfiguredSyncService(
      createAdapter({
        getActivityMap: async () => {
          throw new Error("map unavailable");
        },
        getActivityStreams: async () => {
          throw new Error("streams unavailable");
        },
      }),
    );

    const result = await Effect.runPromise(service.syncNow(user.id));

    expect(result.status).toBe("success");
    expect(result.insertedCount).toBe(1);
    expect(result.failedMapCount).toBe(1);
    expect(result.failedStreamCount).toBe(1);
    expect(result.failedDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpoint: "map",
          activityId: "run-1",
        }),
        expect.objectContaining({
          endpoint: "streams",
          activityId: "run-1",
        }),
      ]),
    );
  });

  it("records invalid map payloads as schema validation failures without aborting the sync", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    const adapter = createIntervalsAdapter({
      baseUrl: "https://intervals.test/api/v1",
      fetch: (async (input) => {
        const url = String(input);

        if (url.includes("/athlete/0")) {
          return new Response(
            JSON.stringify({
              id: "i509216",
              email: "runner@example.com",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/activities")) {
          return new Response(
            JSON.stringify([
              {
                id: "run-1",
                type: "Run",
                start_date: "2026-03-20T00:00:00.000Z",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/activity/run-1?intervals=true")) {
          return new Response(
            JSON.stringify({
              id: "run-1",
              icu_athlete_id: "i509216",
              type: "Run",
              start_date: "2026-03-20T00:00:00.000Z",
              moving_time: 2400,
              elapsed_time: 2450,
              distance: 8000,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/activity/run-1/map")) {
          return new Response(
            JSON.stringify({
              latlngs: "invalid",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.includes("/activity/run-1/streams.json")) {
          return new Response(
            JSON.stringify([
              { type: "cadence", data: [82, 83, 84] },
              { type: "heartrate", data: [118, 121, 125] },
              { type: "distance", data: [0, 1000, 2000] },
              { type: "velocity_smooth", data: [3.4, 3.45, 3.5] },
              { type: "fixed_altitude", data: [11, 12, 13] },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("not found", { status: 404 });
      }) as typeof fetch,
    });

    const service = await createConfiguredSyncService(adapter);
    const result = await Effect.runPromise(service.syncNow(user.id));
    const importedMapRows = await db.query.importedActivityMap.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(result.status).toBe("success");
    expect(result.insertedCount).toBe(1);
    expect(result.failedMapCount).toBe(1);
    expect(result.failedDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpoint: "map",
          activityId: "run-1",
        }),
      ]),
    );
    expect(importedMapRows).toHaveLength(0);
  });

  it("stores a per-run warning and no derived efforts when the distance stream is invalid", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    const service = await createConfiguredSyncService(
      createAdapter({
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
            data: [0, 1000, 900],
          },
          {
            type: "velocity_smooth",
            data: [3.4, 3.45, 3.5],
          },
          {
            type: "fixed_altitude",
            data: [11, 12, 13],
          },
        ],
      }),
    );

    const result = await Effect.runPromise(service.syncNow(user.id));
    const effortRows = await db.query.runBestEffort.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const warningRows = await db.query.runProcessingWarning.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const allTimePrRows = await db.query.userAllTimePr.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(result.status).toBe("success");
    expect(effortRows).toHaveLength(0);
    expect(allTimePrRows).toHaveLength(0);
    expect(warningRows).toHaveLength(1);
    expect(warningRows[0]).toMatchObject({
      code: "invalid_distance_stream",
    });
  });

  it("uses the overlap window on later syncs and updates existing activities instead of duplicating them", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    let oldestSeen: string | undefined;
    let distance = 8000;

    const adapter = createAdapter({
      listActivities: async ({ oldest }) => {
        oldestSeen = oldest;
        return [
          {
            id: "run-1",
            type: "Run",
            start_date: "2026-03-20T00:00:00.000Z",
          },
        ];
      },
      getActivityDetail: async ({ activityId }) => ({
        id: activityId,
        icu_athlete_id: "i509216",
        type: "Run",
        start_date: "2026-03-20T12:00:00.000Z",
        moving_time: 2400,
        elapsed_time: 2450,
        distance,
      }),
    });

    const service = await createConfiguredSyncService(adapter);

    const first = await Effect.runPromise(service.syncNow(user.id));
    distance = 9000;
    const second = await Effect.runPromise(service.syncNow(user.id));
    const importedRows = await db.query.importedActivity.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const importedMapRows = await db.query.importedActivityMap.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const importedStreamRows = await db.query.importedActivityStream.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(first.insertedCount).toBe(1);
    expect(second.updatedCount).toBe(1);
    expect(importedRows).toHaveLength(1);
    expect(importedMapRows).toHaveLength(1);
    expect(importedStreamRows).toHaveLength(5);
    expect(importedRows[0]?.distanceMeters).toBe(9000);
    expect(oldestSeen).toBe("2026-03-19");
  });

  it("recomputes derived efforts and PR ownership when an existing run is updated", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const settingsService = await createConfiguredTrainingSettingsService();

    await Effect.runPromise(
      settingsService.upsertForUser(user.id, {
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
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-secret",
      }),
    );

    let streamDistanceStep = 4;

    const service = await createConfiguredSyncService(
      createAdapter({
        getActivityDetail: async ({ activityId }) => ({
          id: activityId,
          icu_athlete_id: "i509216",
          type: "Run",
          start_date: "2026-03-20T00:00:00.000Z",
          moving_time: 2000,
          elapsed_time: 2000,
          distance: 8000,
          average_heartrate: 152,
        }),
        getActivityStreams: async () => {
          const distanceData = Array.from(
            { length: 2001 },
            (_, index) => index * streamDistanceStep,
          );

          return [
            {
              type: "cadence",
              data: distanceData.map(() => 82),
            },
            {
              type: "heartrate",
              data: distanceData.map(() => 150),
            },
            {
              type: "distance",
              data: distanceData,
            },
            {
              type: "velocity_smooth",
              data: distanceData.map(() => 4),
            },
            {
              type: "fixed_altitude",
              data: distanceData.map(() => 11),
            },
          ];
        },
      }),
    );

    await Effect.runPromise(service.syncNow(user.id));

    streamDistanceStep = 5;

    await Effect.runPromise(service.syncNow(user.id));

    const effortRows = await db.query.runBestEffort.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const allTimePrRows = await db.query.userAllTimePr.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const monthlyBestRows = await db.query.userMonthlyBest.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const warningRows = await db.query.runProcessingWarning.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(warningRows).toHaveLength(0);
    expect(effortRows.length).toBeGreaterThan(0);
    expect(
      effortRows.find((row) => row.distanceMeters === 400)?.durationSeconds,
    ).toBe(80);
    expect(
      allTimePrRows.find((row) => row.distanceMeters === 400),
    ).toMatchObject({
      durationSeconds: 80,
      upstreamActivityId: "run-1",
    });
    expect(
      monthlyBestRows.find((row) => row.distanceMeters === 400),
    ).toMatchObject({
      durationSeconds: 80,
      upstreamActivityId: "run-1",
    });
  });
});
