import { db, type Database } from "@corex/db";
import { env } from "@corex/env/server";

import type { IntervalsAdapter } from "../intervals-sync/adapter";
import { createIntervalsAdapter } from "../intervals-sync/adapter";
import { createLiveDerivedPerformanceService } from "../intervals-sync/derived-performance-live";
import {
  createIntervalsSyncModule,
  type IntervalsSyncApi,
} from "../intervals-sync/module";
import {
  createImportedActivityWritePort,
  createSyncLedgerPort,
} from "../intervals-sync/repository";
import { createIntervalsAccountPort } from "./account";
import { createIntervalsAccountStore } from "./account-repository";
import { createCredentialCrypto } from "./crypto";

type LiveIntervalsEnv = Pick<typeof env, "SETTINGS_MASTER_KEY_BASE64">;
type Clock = {
  now: () => Date;
};
type CreateLiveIntervalsSyncApiOptions = {
  db?: Database;
  env?: LiveIntervalsEnv;
  adapter?: IntervalsAdapter;
  clock?: Clock;
};

export function createLiveIntervalsSyncApi(
  options: CreateLiveIntervalsSyncApiOptions = {},
): IntervalsSyncApi {
  const database = options.db ?? db;
  const runtimeEnv = options.env ?? env;
  const upstreamAdapter = options.adapter ?? createIntervalsAdapter();

  const accounts = createIntervalsAccountPort({
    store: createIntervalsAccountStore(database),
    crypto: createCredentialCrypto({
      masterKeyBase64: runtimeEnv.SETTINGS_MASTER_KEY_BASE64,
      keyVersion: 1,
    }),
  });

  return createIntervalsSyncModule({
    accounts,
    ledger: createSyncLedgerPort(database),
    activities: createImportedActivityWritePort(database),
    upstream: {
      getProfile: (input) => upstreamAdapter.getProfile(input),
      listActivities: (input) => upstreamAdapter.listActivities(input),
      getDetail: (input) => upstreamAdapter.getActivityDetail(input),
      getMap: (input) => upstreamAdapter.getActivityMap(input),
      getStreams: (input) => upstreamAdapter.getActivityStreams(input),
    },
    derived: createLiveDerivedPerformanceService({
      db: database,
    }),
    clock: options.clock,
  });
}

export type { IntervalsSyncApi } from "../intervals-sync/module";
