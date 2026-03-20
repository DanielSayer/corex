import { db, type Database } from "@corex/db";
import { env } from "@corex/env/server";

import { createCredentialCrypto } from "./crypto";
import { createTrainingSettingsRepository } from "./repository";
import {
  createTrainingSettingsService,
  type TrainingSettingsService,
} from "./service";

type LiveTrainingSettingsEnv = Pick<typeof env, "SETTINGS_MASTER_KEY_BASE64">;
type CreateLiveTrainingSettingsServiceOptions = {
  db?: Database;
  env?: LiveTrainingSettingsEnv;
};

export function createLiveTrainingSettingsService(
  options: CreateLiveTrainingSettingsServiceOptions = {},
): TrainingSettingsService {
  const database = options.db ?? db;
  const runtimeEnv = options.env ?? env;

  return createTrainingSettingsService({
    repo: createTrainingSettingsRepository(database),
    crypto: createCredentialCrypto({
      masterKeyBase64: runtimeEnv.SETTINGS_MASTER_KEY_BASE64,
      keyVersion: 1,
    }),
  });
}
