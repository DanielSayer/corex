import { beforeEach, describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

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
      availability: null,
      preferences: {
        timezone: "UTC",
        automaticWeeklyPlanRenewalEnabled: false,
      },
      intervalsCredential: {
        hasKey: false,
        username: null,
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
        intervalsApiKey: "intervals-secret-key",
        timezone: "Australia/Brisbane",
      }),
    );
    const stored = await Effect.runPromise(repo.findByUserId(createdUser.id));

    expect(saved.status).toBe("complete");
    expect(saved.intervalsCredential.hasKey).toBe(true);
    expect(stored).not.toBeNull();

    if (!stored) {
      throw new Error("Expected stored training settings");
    }

    expect(stored.intervalsCredential.ciphertext).not.toBe(
      "intervals-secret-key",
    );
    expect(stored.intervalsCredential.username).toBe("runner@example.com");
    expect(stored.preferences.timezone).toBe("Australia/Brisbane");
    expect(stored.preferences.automaticWeeklyPlanRenewalEnabled).toBe(false);

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
        intervalsApiKey: "first-secret",
        timezone: "Australia/Brisbane",
      }),
    );
    const replaced = await Effect.runPromise(
      service.upsertForUser(createdUser.id, {
        availability: {
          monday: { available: false, maxDurationMinutes: null },
          tuesday: { available: true, maxDurationMinutes: 30 },
          wednesday: { available: true, maxDurationMinutes: 75 },
          thursday: { available: false, maxDurationMinutes: null },
          friday: { available: true, maxDurationMinutes: 45 },
          saturday: { available: true, maxDurationMinutes: 120 },
          sunday: { available: false, maxDurationMinutes: null },
        },
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "second-secret",
        timezone: "Pacific/Auckland",
      }),
    );

    if (!replaced.availability) {
      throw new Error("Expected availability to be present after upsert");
    }

    expect(replaced.availability.monday).toEqual({
      available: false,
      maxDurationMinutes: null,
    });
    expect(replaced.preferences.timezone).toBe("Pacific/Auckland");
  });

  it("updates timezone without replacing credentials or availability", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "timezone-update@example.com",
      name: "Timezone Runner",
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
        intervalsApiKey: "first-secret",
        timezone: "Australia/Brisbane",
      }),
    );

    const updated = await Effect.runPromise(
      service.updateTimezoneForUser(createdUser.id, {
        timezone: "Pacific/Auckland",
      }),
    );

    expect(updated.status).toBe("complete");
    expect(updated.preferences.timezone).toBe("Pacific/Auckland");
    expect(updated.preferences.automaticWeeklyPlanRenewalEnabled).toBe(false);
    expect(updated.intervalsCredential.username).toBe("runner@example.com");
  });

  it("updates automatic weekly plan renewal without replacing credentials or availability", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "automatic-renewal-update@example.com",
      name: "Automatic Renewal Runner",
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
        intervalsApiKey: "first-secret",
        timezone: "Australia/Brisbane",
      }),
    );

    const updated = await Effect.runPromise(
      service.updateAutomaticWeeklyPlanRenewalForUser(createdUser.id, {
        enabled: true,
      }),
    );

    expect(updated.status).toBe("complete");
    expect(updated.preferences).toEqual({
      timezone: "Australia/Brisbane",
      automaticWeeklyPlanRenewalEnabled: true,
    });
    expect(updated.intervalsCredential.username).toBe("runner@example.com");
    expect(updated.availability?.saturday).toEqual({
      available: true,
      maxDurationMinutes: 90,
    });
  });

  it("rejects invalid timezone updates", async () => {
    const { db } = await getIntegrationHarness();
    const createdUser = await createUser(db, {
      email: "timezone-invalid@example.com",
      name: "Timezone Invalid",
    });
    const service = createTrainingSettingsService({
      repo: createTrainingSettingsRepository(db),
      crypto: createCredentialCrypto({
        masterKeyBase64,
        keyVersion: 1,
      }),
    });

    const exit = await Effect.runPromiseExit(
      service.updateTimezoneForUser(createdUser.id, {
        timezone: "not-a-timezone",
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toMatchObject({
          message: "Invalid timezone",
        });
      }
    }
  });
});
