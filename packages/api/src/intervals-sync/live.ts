import { db, type Database } from "@corex/db";
import { env } from "@corex/env/server";

import {
  createIntervalsIcuClient,
  type IntervalsIcuClient,
} from "../integrations/intervals-icu";
import { createIntervalsAccountPort } from "../intervals/account";
import { createIntervalsAccountStore } from "../intervals/account-repository";
import { createCredentialCrypto } from "../intervals/crypto";
import { createLiveDerivedPerformanceService } from "./derived-performance-live";
import { createIntervalsSyncModule, type IntervalsSyncApi } from "./module";
import {
  createImportedActivityWritePort,
  createSyncLedgerPort,
} from "./repository";

type LiveIntervalsEnv = Pick<typeof env, "SETTINGS_MASTER_KEY_BASE64">;
type Clock = {
  now: () => Date;
};
type CreateLiveIntervalsSyncApiOptions = {
  db?: Database;
  env?: LiveIntervalsEnv;
  client?: IntervalsIcuClient;
  adapter?: IntervalsIcuClient;
  clock?: Clock;
};

export function createLiveIntervalsSyncApi(
  options: CreateLiveIntervalsSyncApiOptions = {},
): IntervalsSyncApi {
  const database = options.db ?? db;
  const runtimeEnv = options.env ?? env;
  const intervalsClient =
    options.client ?? options.adapter ?? createIntervalsIcuClient();

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
      getProfile: (input) => intervalsClient.getProfile(input),
      listActivities: (input) => intervalsClient.listActivities(input),
      getDetail: (input) => intervalsClient.getActivityDetail(input),
      getMap: (input) => intervalsClient.getActivityMap(input),
      getStreams: (input) => intervalsClient.getActivityStreams(input),
    },
    derived: createLiveDerivedPerformanceService({
      db: database,
    }),
    clock: options.clock,
  });
}

export type { IntervalsSyncApi } from "./module";
