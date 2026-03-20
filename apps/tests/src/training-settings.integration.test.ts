import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";

import { getIntegrationHarness, resetDatabase } from "./harness";

const masterKeyBase64 = Buffer.alloc(32, 9).toString("base64");

describe("training settings integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns the not-started state for a user with no saved settings", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const service = createTrainingSettingsService({
      repo: createTrainingSettingsRepository(db),
      crypto: createCredentialCrypto({
        masterKeyBase64,
        keyVersion: 1,
      }),
    });
    const result = await Effect.runPromise(service.getForUser(createdUser.id));

    expect(result).toEqual({
      status: "not_started",
      goal: null,
      availability: null,
      intervalsCredential: {
        hasKey: false,
        updatedAt: null,
      },
    });
  });

  it("persists settings, stores the credential encrypted, and returns the saved aggregate", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const repo = createTrainingSettingsRepository(db);
    const crypto = createCredentialCrypto({
      masterKeyBase64,
      keyVersion: 1,
    });
    const service = createTrainingSettingsService({
      repo,
      crypto,
    });

    const saved = await Effect.runPromise(
      service.upsertForUser(createdUser.id, {
        goal: {
          type: "event_goal",
          targetDistance: {
            value: 21.1,
            unit: "km",
          },
          targetDate: "2026-08-01",
          eventName: "City Half",
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
        intervalsApiKey: "intervals-secret-key",
      }),
    );
    const stored = await Effect.runPromise(repo.findByUserId(createdUser.id));

    expect(saved.status).toBe("complete");
    expect(saved.intervalsCredential.hasKey).toBe(true);
    expect(saved.goal).toMatchObject({
      type: "event_goal",
      eventName: "City Half",
    });
    expect(stored).not.toBeNull();

    if (!stored) {
      throw new Error("Expected stored training settings");
    }

    expect(stored.intervalsCredential.ciphertext).not.toBe("intervals-secret-key");

    const decrypted = await Effect.runPromise(
      crypto.decrypt(createdUser.id, {
        ciphertext: stored.intervalsCredential.ciphertext,
        iv: stored.intervalsCredential.iv,
        tag: stored.intervalsCredential.tag,
        keyVersion: stored.intervalsCredential.keyVersion,
      }),
    );
    const loaded = await Effect.runPromise(service.getForUser(createdUser.id));

    expect(decrypted).toBe("intervals-secret-key");
    expect(loaded).toEqual(saved);
  });

  it("replaces existing settings in place on a later upsert", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "runner@example.com",
      name: "Runner One",
    });
    const service = createTrainingSettingsService({
      repo: createTrainingSettingsRepository(db),
      crypto: createCredentialCrypto({
        masterKeyBase64,
        keyVersion: 1,
      }),
    });

    await Effect.runPromise(
      service.upsertForUser(createdUser.id, {
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
        intervalsApiKey: "first-secret",
      }),
    );
    const replaced = await Effect.runPromise(
      service.upsertForUser(createdUser.id, {
        goal: {
          type: "volume_goal",
          metric: "time",
          period: "month",
          targetValue: 480,
          unit: "minutes",
        },
        availability: {
          monday: { available: false, maxDurationMinutes: null },
          tuesday: { available: true, maxDurationMinutes: 30 },
          wednesday: { available: true, maxDurationMinutes: 75 },
          thursday: { available: false, maxDurationMinutes: null },
          friday: { available: true, maxDurationMinutes: 45 },
          saturday: { available: true, maxDurationMinutes: 120 },
          sunday: { available: false, maxDurationMinutes: null },
        },
        intervalsApiKey: "second-secret",
      }),
    );

    if (!replaced.availability) {
      throw new Error("Expected availability to be present after upsert");
    }

    expect(replaced.goal).toEqual({
      type: "volume_goal",
      metric: "time",
      period: "month",
      targetValue: 480,
      unit: "minutes",
    });
    expect(replaced.availability.monday).toEqual({
      available: false,
      maxDurationMinutes: null,
    });
  });
});
