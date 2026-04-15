import { Effect } from "effect";

import {
  trainingPreferencesSchema,
  trainingSettingsInputSchema,
  type TrainingSettingsInput,
  type TrainingGoal,
  type TrainingPreferences,
} from "./contracts";
import type { CredentialCrypto } from "../intervals/crypto";
import { InvalidApiKeyFormat, InvalidSettings } from "./errors";
import type {
  StoredTrainingSettings,
  TrainingSettingsRepository,
} from "./repository";

export type TrainingSettingsView = {
  status: "not_started" | "complete";
  availability: TrainingSettingsInput["availability"] | null;
  preferences: TrainingPreferences;
  intervalsCredential: {
    hasKey: boolean;
    username: string | null;
    updatedAt: string | null;
  };
};

type CreateTrainingSettingsServiceOptions = {
  repo: TrainingSettingsRepository;
  crypto: CredentialCrypto;
};

function createEmptyState(): TrainingSettingsView {
  return {
    status: "not_started",
    availability: null,
    preferences: {
      timezone: "UTC",
    },
    intervalsCredential: {
      hasKey: false,
      username: null,
      updatedAt: null,
    },
  };
}

function toView(stored: StoredTrainingSettings): TrainingSettingsView {
  return {
    status: "complete",
    availability: stored.availability,
    preferences: stored.preferences,
    intervalsCredential: {
      hasKey: true,
      username: stored.intervalsCredential.username,
      updatedAt: stored.intervalsCredential.updatedAt.toISOString(),
    },
  };
}

function validatePreferences(
  input: TrainingPreferences,
): Effect.Effect<TrainingPreferences, InvalidSettings> {
  const result = trainingPreferencesSchema.safeParse(input);

  if (!result.success) {
    return Effect.fail(
      new InvalidSettings({
        message:
          result.error.issues[0]?.message ?? "Invalid training preferences",
      }),
    );
  }

  return Effect.succeed(result.data);
}

function validateInput(
  input: TrainingSettingsInput & { goal?: TrainingGoal },
): Effect.Effect<TrainingSettingsInput, InvalidApiKeyFormat | InvalidSettings> {
  if (
    typeof input.intervalsUsername !== "string" ||
    input.intervalsUsername.trim().length === 0
  ) {
    return Effect.fail(
      new InvalidSettings({
        message: "Intervals username is required",
      }),
    );
  }

  if (
    typeof input.intervalsApiKey !== "string" ||
    input.intervalsApiKey.trim().length === 0
  ) {
    return Effect.fail(
      new InvalidApiKeyFormat({
        message: "Intervals API key is required",
      }),
    );
  }

  const result = trainingSettingsInputSchema.safeParse(input);

  if (!result.success) {
    return Effect.fail(
      new InvalidSettings({
        message: result.error.issues[0]?.message ?? "Invalid training settings",
      }),
    );
  }

  return Effect.succeed(result.data);
}

export function createTrainingSettingsService(
  options: CreateTrainingSettingsServiceOptions,
) {
  const getForUser = (
    userId: string,
  ): Effect.Effect<TrainingSettingsView, unknown> =>
    Effect.gen(function* () {
      const [stored, preferences] = yield* Effect.all([
        options.repo.findByUserId(userId),
        options.repo.findPreferencesByUserId(userId),
      ]);

      if (stored) {
        return toView(stored);
      }

      return {
        ...createEmptyState(),
        preferences: {
          timezone: preferences?.timezone ?? "UTC",
        },
      };
    });

  return {
    getForUser(userId: string): Effect.Effect<TrainingSettingsView, unknown> {
      return getForUser(userId);
    },
    getTimezoneForUser(userId: string): Effect.Effect<string, unknown> {
      return Effect.map(
        options.repo.findPreferencesByUserId(userId),
        (preferences) => preferences?.timezone ?? "UTC",
      );
    },
    upsertForUser(
      userId: string,
      input: TrainingSettingsInput & { goal?: TrainingGoal },
    ): Effect.Effect<TrainingSettingsView, unknown> {
      return Effect.gen(function* () {
        const validatedInput = yield* validateInput(input);
        const encryptedCredential = yield* options.crypto.encrypt(
          userId,
          validatedInput.intervalsApiKey.trim(),
        );
        const stored = yield* options.repo.upsert({
          userId,
          availability: validatedInput.availability,
          preferences: {
            timezone: validatedInput.timezone,
          },
          intervalsUsername: validatedInput.intervalsUsername.trim(),
          intervalsCredential: encryptedCredential,
        });

        return toView(stored);
      });
    },
    updateTimezoneForUser(
      userId: string,
      preferences: TrainingPreferences,
    ): Effect.Effect<TrainingSettingsView, unknown> {
      return Effect.gen(function* () {
        const validatedPreferences = yield* validatePreferences(preferences);
        yield* options.repo.upsertPreferences(userId, validatedPreferences);
        return yield* getForUser(userId);
      });
    },
  };
}

export type TrainingSettingsService = ReturnType<
  typeof createTrainingSettingsService
>;
