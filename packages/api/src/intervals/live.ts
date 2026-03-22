import { db, type Database } from "@corex/db";
import { env } from "@corex/env/server";

import type { IntervalsAdapter } from "../intervals-sync/adapter";
import { createIntervalsSyncRepository } from "../intervals-sync/repository";
import {
  createIntervalsSyncService,
  type IntervalsSyncService,
} from "../intervals-sync/service";
import { createIntervalsAdapter } from "../intervals-sync/adapter";
import { createIntervalsAccountService } from "./account";
import { createIntervalsAccountStore } from "./account-repository";
import { createCredentialCrypto } from "./crypto";

type LiveIntervalsEnv = Pick<typeof env, "SETTINGS_MASTER_KEY_BASE64">;
type Clock = {
  now: () => Date;
};
type CreateLiveIntervalsSyncServiceOptions = {
  db?: Database;
  env?: LiveIntervalsEnv;
  adapter?: IntervalsAdapter;
  clock?: Clock;
};

export function createLiveIntervalsSyncService(
  options: CreateLiveIntervalsSyncServiceOptions = {},
): IntervalsSyncService {
  const database = options.db ?? db;
  const runtimeEnv = options.env ?? env;

  const account = createIntervalsAccountService({
    store: createIntervalsAccountStore(database),
    crypto: createCredentialCrypto({
      masterKeyBase64: runtimeEnv.SETTINGS_MASTER_KEY_BASE64,
      keyVersion: 1,
    }),
  });

  return createIntervalsSyncService({
    account,
    syncRepo: createIntervalsSyncRepository(database),
    adapter: options.adapter ?? createIntervalsAdapter(),
    clock: options.clock,
  });
}

export type { IntervalsSyncService } from "../intervals-sync/service";
