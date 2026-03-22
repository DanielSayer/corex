import { beforeEach, describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import type { IntervalsAdapter } from "@corex/api/intervals-sync/adapter";
import { createLiveIntervalsSyncService } from "@corex/api/intervals-sync/live";
import { createIntervalsSyncRepository } from "@corex/api/intervals-sync/repository";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";

import { getIntegrationHarness, resetDatabase } from "./harness";

const masterKeyBase64 = Buffer.alloc(32, 9).toString("base64");

function createAdapter(
  overrides: Partial<IntervalsAdapter> = {},
): IntervalsAdapter {
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
      start_date: "2026-03-20T00:00:00.000Z",
      moving_time: 2400,
      elapsed_time: 2450,
      distance: 8000,
      average_heartrate: 152,
    }),
    ...overrides,
  };
}

async function createConfiguredSyncService(adapter: IntervalsAdapter) {
  const { db } = await getIntegrationHarness();

  return createLiveIntervalsSyncService({
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
  });

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
    const result = await Effect.runPromise(service.triggerForUser(user.id));
    const importedRows = await db.query.importedActivity.findMany({
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
    expect(importedRows[0]?.rawDetail).toMatchObject({
      id: "run-1",
      distance: 8000,
    });
    expect(storedSettings?.intervalsCredential.athleteId).toBe("i509216");
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
    const result = await Effect.runPromise(service.triggerForUser(user.id));
    const latest = await Effect.runPromise(
      createIntervalsSyncRepository(db).getLatestSyncSummary(user.id),
    );

    expect(result.status).toBe("success");
    expect(latest?.status).toBe("success");
    expect(latest?.insertedCount).toBe(1);
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

    const exit = await Effect.runPromiseExit(service.triggerForUser(user.id));

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);
    }

    const latest = await Effect.runPromise(
      createIntervalsSyncRepository(db).getLatestSyncSummary(user.id),
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

    const result = await Effect.runPromise(service.triggerForUser(user.id));

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

    const first = await Effect.runPromise(service.triggerForUser(user.id));
    distance = 9000;
    const second = await Effect.runPromise(service.triggerForUser(user.id));
    const importedRows = await db.query.importedActivity.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(first.insertedCount).toBe(1);
    expect(second.updatedCount).toBe(1);
    expect(importedRows).toHaveLength(1);
    expect(importedRows[0]?.distanceMeters).toBe(9000);
    expect(oldestSeen).toBe("2026-03-19");
  });
});
