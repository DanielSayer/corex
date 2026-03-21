import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import type { TrainingSettingsInput } from "./contracts";
import { InvalidApiKeyFormat, InvalidSettings } from "./errors";
import type {
  StoredTrainingSettings,
  TrainingSettingsRepository,
} from "./repository";
import { createTrainingSettingsService } from "./service";

const sampleInput: TrainingSettingsInput = {
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
  intervalsApiKey: "secret-key",
};

function createStoredSettings(): StoredTrainingSettings {
  return {
    userId: "user-1",
    goal: sampleInput.goal,
    availability: sampleInput.availability,
    intervalsCredential: {
      username: sampleInput.intervalsUsername,
      athleteId: null,
      athleteResolvedAt: null,
      ciphertext: "ciphertext",
      iv: "iv",
      tag: "tag",
      keyVersion: 1,
      updatedAt: new Date("2026-03-20T00:00:00.000Z"),
    },
    createdAt: new Date("2026-03-20T00:00:00.000Z"),
    updatedAt: new Date("2026-03-20T00:00:00.000Z"),
  };
}

function createRepo(
  overrides: Partial<TrainingSettingsRepository> = {},
): TrainingSettingsRepository {
  return {
    findByUserId: () => Effect.succeed(null),
    upsert: () => Effect.succeed(createStoredSettings()),
    saveIntervalsAthleteIdentity: () => Effect.void,
    ...overrides,
  };
}

describe("training settings service", () => {
  it("returns the not-started state when no settings are stored", async () => {
    const service = createTrainingSettingsService({
      repo: createRepo({
        findByUserId: () => Effect.succeed(null),
      }),
      crypto: {
        encrypt: () => Effect.die("not used"),
        decrypt: () => Effect.die("not used"),
      },
    });

    await expect(
      Effect.runPromise(service.getForUser("user-1")),
    ).resolves.toEqual({
      status: "not_started",
      goal: null,
      availability: null,
      intervalsCredential: {
        hasKey: false,
        username: null,
        updatedAt: null,
      },
    });
  });

  it("stores encrypted credentials and returns the redacted aggregate", async () => {
    let persistedRecord:
      | Parameters<TrainingSettingsRepository["upsert"]>[0]
      | undefined;

    const service = createTrainingSettingsService({
      repo: createRepo({
        upsert: (record) => {
          persistedRecord = record;
          return Effect.succeed(createStoredSettings());
        },
      }),
      crypto: {
        encrypt: () =>
          Effect.succeed({
            ciphertext: "ciphertext",
            iv: "iv",
            tag: "tag",
            keyVersion: 1,
          }),
        decrypt: () => Effect.die("not used"),
      },
    });

    await expect(
      Effect.runPromise(service.upsertForUser("user-1", sampleInput)),
    ).resolves.toEqual({
      status: "complete",
      goal: sampleInput.goal,
      availability: sampleInput.availability,
      intervalsCredential: {
        hasKey: true,
        username: sampleInput.intervalsUsername,
        updatedAt: "2026-03-20T00:00:00.000Z",
      },
    });

    expect(persistedRecord).toEqual({
      userId: "user-1",
      goal: sampleInput.goal,
      availability: sampleInput.availability,
      intervalsUsername: sampleInput.intervalsUsername,
      intervalsCredential: {
        ciphertext: "ciphertext",
        iv: "iv",
        tag: "tag",
        keyVersion: 1,
      },
    });
  });

  it("rejects structurally invalid settings before encryption or persistence", async () => {
    let encryptCalls = 0;
    let upsertCalls = 0;

    const service = createTrainingSettingsService({
      repo: createRepo({
        upsert: () => {
          upsertCalls += 1;
          return Effect.succeed(createStoredSettings());
        },
      }),
      crypto: {
        encrypt: () => {
          encryptCalls += 1;
          return Effect.succeed({
            ciphertext: "ciphertext",
            iv: "iv",
            tag: "tag",
            keyVersion: 1,
          });
        },
        decrypt: () => Effect.die("not used"),
      },
    });

    const exit = await Effect.runPromiseExit(
      service.upsertForUser("user-1", {
        ...sampleInput,
        availability: {
          ...sampleInput.availability,
          sunday: {
            available: false,
            maxDurationMinutes: 30,
          },
        },
      } as TrainingSettingsInput),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(InvalidSettings);
      }
    }

    expect(encryptCalls).toBe(0);
    expect(upsertCalls).toBe(0);
  });

  it("rejects blank api keys before encryption or persistence", async () => {
    let encryptCalls = 0;
    let upsertCalls = 0;

    const service = createTrainingSettingsService({
      repo: createRepo({
        upsert: () => {
          upsertCalls += 1;
          return Effect.succeed(createStoredSettings());
        },
      }),
      crypto: {
        encrypt: () => {
          encryptCalls += 1;
          return Effect.succeed({
            ciphertext: "ciphertext",
            iv: "iv",
            tag: "tag",
            keyVersion: 1,
          });
        },
        decrypt: () => Effect.die("not used"),
      },
    });

    const exit = await Effect.runPromiseExit(
      service.upsertForUser("user-1", {
        ...sampleInput,
        intervalsApiKey: "   ",
      } as TrainingSettingsInput),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(InvalidApiKeyFormat);
      }
    }

    expect(encryptCalls).toBe(0);
    expect(upsertCalls).toBe(0);
  });

  it("rejects blank usernames before encryption or persistence", async () => {
    let encryptCalls = 0;
    let upsertCalls = 0;

    const service = createTrainingSettingsService({
      repo: createRepo({
        upsert: () => {
          upsertCalls += 1;
          return Effect.succeed(createStoredSettings());
        },
      }),
      crypto: {
        encrypt: () => {
          encryptCalls += 1;
          return Effect.succeed({
            ciphertext: "ciphertext",
            iv: "iv",
            tag: "tag",
            keyVersion: 1,
          });
        },
        decrypt: () => Effect.die("not used"),
      },
    });

    const exit = await Effect.runPromiseExit(
      service.upsertForUser("user-1", {
        ...sampleInput,
        intervalsUsername: "   ",
      } as TrainingSettingsInput),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(InvalidSettings);
      }
    }

    expect(encryptCalls).toBe(0);
    expect(upsertCalls).toBe(0);
  });
});
