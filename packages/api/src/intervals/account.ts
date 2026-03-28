import { Effect } from "effect";

import {
  MissingIntervalsCredentials,
  SyncPersistenceFailure,
} from "../intervals-sync/errors";
import type { CredentialCrypto } from "./crypto";
import type { IntervalsAccountStore } from "./account-repository";

export type IntervalsAccount = {
  username: string;
  apiKey: string;
  athleteId: string | null;
};

export type IntervalsAccountPort = {
  load: (
    userId: string,
  ) => Effect.Effect<
    IntervalsAccount,
    MissingIntervalsCredentials | SyncPersistenceFailure
  >;
  saveResolvedAthlete: (
    userId: string,
    identity: {
      athleteId: string;
      resolvedAt: Date;
    },
  ) => Effect.Effect<void, SyncPersistenceFailure>;
};

export type IntervalsAccountService = IntervalsAccountPort & {
  loadAccountForUser: IntervalsAccountPort["load"];
  recordResolvedAthleteIdentity: IntervalsAccountPort["saveResolvedAthlete"];
};

type CreateIntervalsAccountServiceOptions = {
  store: IntervalsAccountStore;
  crypto: CredentialCrypto;
};

function toPersistenceFailure(cause: { message: string; cause?: unknown }) {
  return new SyncPersistenceFailure({
    message: cause.message,
    cause: cause.cause,
  });
}

export function createIntervalsAccountPort(
  options: CreateIntervalsAccountServiceOptions,
): IntervalsAccountService {
  const port = {
    load(userId) {
      return Effect.gen(function* () {
        const storedAccount = yield* options.store.findAccountByUserId(userId);

        if (!storedAccount) {
          return yield* Effect.fail(
            new MissingIntervalsCredentials({
              message: "Intervals credentials are required before syncing",
            }),
          );
        }

        const apiKey = yield* Effect.mapError(
          options.crypto.decrypt(userId, {
            ciphertext: storedAccount.ciphertext,
            iv: storedAccount.iv,
            tag: storedAccount.tag,
            keyVersion: storedAccount.keyVersion,
          }),
          toPersistenceFailure,
        );

        return {
          username: storedAccount.username,
          apiKey,
          athleteId: storedAccount.athleteId,
        };
      });
    },
    saveResolvedAthlete(userId, identity) {
      return options.store.saveAthleteIdentity(userId, identity);
    },
  } satisfies IntervalsAccountPort;

  return {
    ...port,
    loadAccountForUser: port.load,
    recordResolvedAthleteIdentity: port.saveResolvedAthlete,
  };
}

export const createIntervalsAccountService = createIntervalsAccountPort;
