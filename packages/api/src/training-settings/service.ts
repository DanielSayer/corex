import { Effect } from "effect";

import {
  trainingSettingsInputSchema,
  type TrainingSettingsInput,
} from "./contracts";
import type { CredentialCrypto } from "./crypto";
import { InvalidApiKeyFormat, InvalidSettings } from "./errors";
import type {
  StoredTrainingSettings,
  TrainingSettingsRepository,
} from "./repository";

export type TrainingSettingsView = {
  status: "not_started" | "complete";
  goal: TrainingSettingsInput["goal"] | null;
  availability: TrainingSettingsInput["availability"] | null;
  intervalsCredential: {
    hasKey: boolean;
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
    goal: null,
    availability: null,
    intervalsCredential: {
      hasKey: false,
      updatedAt: null,
    },
  };
}

function toView(stored: StoredTrainingSettings): TrainingSettingsView {
  return {
    status: "complete",
    goal: stored.goal,
    availability: stored.availability,
    intervalsCredential: {
      hasKey: true,
      updatedAt: stored.intervalsCredential.updatedAt.toISOString(),
    },
  };
}

function validateInput(
  input: TrainingSettingsInput,
): Effect.Effect<TrainingSettingsInput, InvalidApiKeyFormat | InvalidSettings> {
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
  return {
    getForUser(userId: string): Effect.Effect<TrainingSettingsView, unknown> {
      return Effect.map(options.repo.findByUserId(userId), (stored) =>
        stored ? toView(stored) : createEmptyState(),
      );
    },
    upsertForUser(
      userId: string,
      input: TrainingSettingsInput,
    ): Effect.Effect<TrainingSettingsView, unknown> {
      return Effect.gen(function* () {
        const validatedInput = yield* validateInput(input);
        const encryptedCredential = yield* options.crypto.encrypt(
          userId,
          validatedInput.intervalsApiKey.trim(),
        );
        const stored = yield* options.repo.upsert({
          userId,
          goal: validatedInput.goal,
          availability: validatedInput.availability,
          intervalsCredential: encryptedCredential,
        });

        return toView(stored);
      });
    },
  };
}

export type TrainingSettingsService = ReturnType<
  typeof createTrainingSettingsService
>;
