import { eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { intervalsCredential } from "@corex/db/schema/training-settings";

import { SyncPersistenceFailure } from "../intervals-sync/errors";

export type StoredIntervalsAccount = {
  username: string;
  athleteId: string | null;
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
};

export type IntervalsAccountStore = {
  findAccountByUserId: (
    userId: string,
  ) => Effect.Effect<StoredIntervalsAccount | null, SyncPersistenceFailure>;
  saveAthleteIdentity: (
    userId: string,
    identity: {
      athleteId: string;
      resolvedAt: Date;
    },
  ) => Effect.Effect<void, SyncPersistenceFailure>;
};

export function createIntervalsAccountStore(
  db: Database,
): IntervalsAccountStore {
  return {
    findAccountByUserId(userId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.intervalsCredential.findFirst({
            where: eq(intervalsCredential.userId, userId),
          });

          if (!row) {
            return null;
          }

          return {
            username: row.intervalsUsername,
            athleteId: row.intervalsAthleteId,
            ciphertext: row.intervalsApiKeyCiphertext,
            iv: row.intervalsApiKeyIv,
            tag: row.intervalsApiKeyTag,
            keyVersion: row.intervalsApiKeyKeyVersion,
          };
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to load Intervals account",
            cause,
          }),
      });
    },
    saveAthleteIdentity(userId, identity) {
      return Effect.tryPromise({
        try: async () => {
          await db
            .update(intervalsCredential)
            .set({
              intervalsAthleteId: identity.athleteId,
              intervalsAthleteResolvedAt: identity.resolvedAt,
              updatedAt: identity.resolvedAt,
            })
            .where(eq(intervalsCredential.userId, userId));
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to persist Intervals athlete identity",
            cause,
          }),
      });
    },
  };
}
