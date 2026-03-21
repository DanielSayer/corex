import { db, type Database } from "@corex/db";
import { env } from "@corex/env/server";

import { createCredentialCrypto } from "../training-settings/crypto";
import { createTrainingSettingsRepository } from "../training-settings/repository";
import { createIntervalsAdapter } from "./adapter";
import { createIntervalsSyncRepository } from "./repository";
import { createIntervalsSyncService, type IntervalsSyncService } from "./service";

type LiveIntervalsSyncEnv = Pick<typeof env, "SETTINGS_MASTER_KEY_BASE64">;
type CreateLiveIntervalsSyncServiceOptions = {
  db?: Database;
  env?: LiveIntervalsSyncEnv;
};

export function createLiveIntervalsSyncService(
  options: CreateLiveIntervalsSyncServiceOptions = {},
): IntervalsSyncService {
  const database = options.db ?? db;
  const runtimeEnv = options.env ?? env;

  return createIntervalsSyncService({
    trainingSettingsRepo: createTrainingSettingsRepository(database),
    syncRepo: createIntervalsSyncRepository(database),
    crypto: createCredentialCrypto({
      masterKeyBase64: runtimeEnv.SETTINGS_MASTER_KEY_BASE64,
      keyVersion: 1,
    }),
    adapter: createIntervalsAdapter(),
  });
}
