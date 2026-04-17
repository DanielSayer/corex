import { asc, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  intervalsCredential,
  trainingAvailability,
  userTrainingPreference,
} from "@corex/db/schema/training-settings";

import type { TrainingPreferences, WeeklyAvailability } from "./contracts";
import { PersistenceFailure } from "./errors";

export type StoredEncryptedCredential = {
  username: string;
  athleteId: string | null;
  athleteResolvedAt: Date | null;
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
  updatedAt: Date;
};

export type StoredTrainingSettings = {
  userId: string;
  availability: WeeklyAvailability;
  preferences: TrainingPreferences;
  intervalsCredential: StoredEncryptedCredential;
  updatedAt: Date;
};

export type StoredTrainingPreferences = TrainingPreferences & {
  updatedAt: Date;
};

export type UpsertTrainingSettingsRecord = {
  userId: string;
  availability: WeeklyAvailability;
  preferences: TrainingPreferences;
  intervalsUsername: string;
  intervalsCredential: Omit<
    StoredEncryptedCredential,
    "username" | "athleteId" | "athleteResolvedAt" | "updatedAt"
  >;
};

export type TrainingSettingsRepository = {
  findByUserId: (
    userId: string,
  ) => Effect.Effect<StoredTrainingSettings | null, PersistenceFailure>;
  findPreferencesByUserId: (
    userId: string,
  ) => Effect.Effect<StoredTrainingPreferences | null, PersistenceFailure>;
  upsert: (
    record: UpsertTrainingSettingsRecord,
  ) => Effect.Effect<StoredTrainingSettings, PersistenceFailure>;
  upsertPreferences: (
    userId: string,
    preferences: TrainingPreferences,
  ) => Effect.Effect<StoredTrainingPreferences, PersistenceFailure>;
  saveIntervalsAthleteIdentity: (
    userId: string,
    identity: {
      athleteId: string;
      resolvedAt: Date;
      timezone?: string | null;
    },
  ) => Effect.Effect<void, PersistenceFailure>;
};

export const dayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function mapAvailabilityRows(
  rows: Array<typeof trainingAvailability.$inferSelect>,
): WeeklyAvailability {
  if (rows.length !== dayOrder.length) {
    throw new PersistenceFailure({
      message: "Stored availability is incomplete",
    });
  }

  const availability = {} as WeeklyAvailability;

  for (const day of dayOrder) {
    const row = rows.find((candidate) => candidate.dayOfWeek === day);

    if (!row) {
      throw new PersistenceFailure({
        message: `Stored availability is missing ${day}`,
      });
    }

    availability[day] = {
      available: row.available,
      maxDurationMinutes: row.maxDurationMinutes,
    };
  }

  return availability;
}

function buildAvailabilityInsert(
  userId: string,
  availability: WeeklyAvailability,
  now: Date,
) {
  return dayOrder.map((day) => ({
    userId,
    dayOfWeek: day,
    available: availability[day].available,
    maxDurationMinutes: availability[day].maxDurationMinutes,
    updatedAt: now,
  }));
}

function mapPreferenceRow(
  row: typeof userTrainingPreference.$inferSelect | undefined,
): StoredTrainingPreferences | null {
  if (!row) {
    return null;
  }

  return {
    timezone: row.timezone,
    automaticWeeklyPlanRenewalEnabled: row.automaticWeeklyPlanRenewalEnabled,
    updatedAt: row.updatedAt,
  };
}

function mapStoredAggregate(
  userId: string,
  availabilityRows: Array<typeof trainingAvailability.$inferSelect>,
  credentialRow: typeof intervalsCredential.$inferSelect | undefined,
  preferenceRow: typeof userTrainingPreference.$inferSelect | undefined,
): StoredTrainingSettings | null {
  if (availabilityRows.length === 0 && !credentialRow) {
    return null;
  }

  if (availabilityRows.length === 0 || !credentialRow) {
    throw new PersistenceFailure({
      message: "Stored training settings are incomplete",
    });
  }

  const preferences = mapPreferenceRow(preferenceRow) ?? {
    timezone: "UTC",
    automaticWeeklyPlanRenewalEnabled: false,
    updatedAt: credentialRow.updatedAt,
  };

  return {
    userId,
    availability: mapAvailabilityRows(availabilityRows),
    preferences: {
      timezone: preferences.timezone,
      automaticWeeklyPlanRenewalEnabled:
        preferences.automaticWeeklyPlanRenewalEnabled,
    },
    intervalsCredential: {
      username: credentialRow.intervalsUsername,
      athleteId: credentialRow.intervalsAthleteId,
      athleteResolvedAt: credentialRow.intervalsAthleteResolvedAt,
      ciphertext: credentialRow.intervalsApiKeyCiphertext,
      iv: credentialRow.intervalsApiKeyIv,
      tag: credentialRow.intervalsApiKeyTag,
      keyVersion: credentialRow.intervalsApiKeyKeyVersion,
      updatedAt: credentialRow.intervalsApiKeyUpdatedAt,
    },
    updatedAt: [
      preferences.updatedAt,
      credentialRow.updatedAt,
      ...availabilityRows.map((row) => row.updatedAt),
    ].reduce((latest, current) => (current > latest ? current : latest)),
  };
}

async function findStoredTrainingSettings(db: Database, userId: string) {
  const [availabilityRows, credentialRow, preferenceRow] = await Promise.all([
    db.query.trainingAvailability.findMany({
      where: eq(trainingAvailability.userId, userId),
      orderBy: asc(trainingAvailability.dayOfWeek),
    }),
    db.query.intervalsCredential.findFirst({
      where: eq(intervalsCredential.userId, userId),
    }),
    db.query.userTrainingPreference.findFirst({
      where: eq(userTrainingPreference.userId, userId),
    }),
  ]);

  return mapStoredAggregate(
    userId,
    availabilityRows,
    credentialRow,
    preferenceRow,
  );
}

async function findStoredPreferences(db: Database, userId: string) {
  const row = await db.query.userTrainingPreference.findFirst({
    where: eq(userTrainingPreference.userId, userId),
  });

  return mapPreferenceRow(row);
}

async function upsertStoredPreferences(
  db: Database,
  userId: string,
  preferences: TrainingPreferences,
) {
  const now = new Date();

  await db
    .insert(userTrainingPreference)
    .values({
      userId,
      timezone: preferences.timezone,
      automaticWeeklyPlanRenewalEnabled:
        preferences.automaticWeeklyPlanRenewalEnabled,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userTrainingPreference.userId,
      set: {
        timezone: preferences.timezone,
        automaticWeeklyPlanRenewalEnabled:
          preferences.automaticWeeklyPlanRenewalEnabled,
        updatedAt: now,
      },
    });

  const stored = await findStoredPreferences(db, userId);

  if (!stored) {
    throw new PersistenceFailure({
      message: "Persisted training preferences could not be reloaded",
    });
  }

  return stored;
}

export function createTrainingSettingsRepository(
  db: Database,
): TrainingSettingsRepository {
  return {
    findByUserId(userId) {
      return Effect.tryPromise({
        try: () => findStoredTrainingSettings(db, userId),
        catch: (cause) =>
          cause instanceof PersistenceFailure
            ? cause
            : new PersistenceFailure({
                message: "Failed to load training settings",
                cause,
              }),
      });
    },
    findPreferencesByUserId(userId) {
      return Effect.tryPromise({
        try: () => findStoredPreferences(db, userId),
        catch: (cause) =>
          cause instanceof PersistenceFailure
            ? cause
            : new PersistenceFailure({
                message: "Failed to load training preferences",
                cause,
              }),
      });
    },
    upsert(record) {
      return Effect.tryPromise({
        try: async () => {
          const now = new Date();
          await db.transaction(async (tx) => {
            await tx
              .insert(userTrainingPreference)
              .values({
                userId: record.userId,
                timezone: record.preferences.timezone,
                automaticWeeklyPlanRenewalEnabled:
                  record.preferences.automaticWeeklyPlanRenewalEnabled,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: userTrainingPreference.userId,
                set: {
                  timezone: record.preferences.timezone,
                  automaticWeeklyPlanRenewalEnabled:
                    record.preferences.automaticWeeklyPlanRenewalEnabled,
                  updatedAt: now,
                },
              });

            await tx
              .insert(intervalsCredential)
              .values({
                userId: record.userId,
                intervalsUsername: record.intervalsUsername,
                intervalsAthleteId: null,
                intervalsAthleteResolvedAt: null,
                intervalsApiKeyCiphertext:
                  record.intervalsCredential.ciphertext,
                intervalsApiKeyIv: record.intervalsCredential.iv,
                intervalsApiKeyTag: record.intervalsCredential.tag,
                intervalsApiKeyKeyVersion:
                  record.intervalsCredential.keyVersion,
                intervalsApiKeyUpdatedAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: intervalsCredential.userId,
                set: {
                  intervalsUsername: record.intervalsUsername,
                  intervalsAthleteId: null,
                  intervalsAthleteResolvedAt: null,
                  intervalsApiKeyCiphertext:
                    record.intervalsCredential.ciphertext,
                  intervalsApiKeyIv: record.intervalsCredential.iv,
                  intervalsApiKeyTag: record.intervalsCredential.tag,
                  intervalsApiKeyKeyVersion:
                    record.intervalsCredential.keyVersion,
                  intervalsApiKeyUpdatedAt: now,
                  updatedAt: now,
                },
              });

            await tx
              .delete(trainingAvailability)
              .where(eq(trainingAvailability.userId, record.userId));
            await tx
              .insert(trainingAvailability)
              .values(
                buildAvailabilityInsert(
                  record.userId,
                  record.availability,
                  now,
                ),
              );
          });

          const stored = await findStoredTrainingSettings(db, record.userId);

          if (!stored) {
            throw new PersistenceFailure({
              message: "Persisted training settings could not be reloaded",
            });
          }

          return stored;
        },
        catch: (cause) =>
          cause instanceof PersistenceFailure
            ? cause
            : new PersistenceFailure({
                message: "Failed to persist training settings",
                cause,
              }),
      });
    },
    upsertPreferences(userId, preferences) {
      return Effect.tryPromise({
        try: () => upsertStoredPreferences(db, userId, preferences),
        catch: (cause) =>
          cause instanceof PersistenceFailure
            ? cause
            : new PersistenceFailure({
                message: "Failed to persist training preferences",
                cause,
              }),
      });
    },
    saveIntervalsAthleteIdentity(userId, identity) {
      return Effect.tryPromise({
        try: async () => {
          await db.transaction(async (tx) => {
            await tx
              .update(intervalsCredential)
              .set({
                intervalsAthleteId: identity.athleteId,
                intervalsAthleteResolvedAt: identity.resolvedAt,
                updatedAt: identity.resolvedAt,
              })
              .where(eq(intervalsCredential.userId, userId));

            if (identity.timezone) {
              await tx
                .insert(userTrainingPreference)
                .values({
                  userId,
                  timezone: identity.timezone,
                  automaticWeeklyPlanRenewalEnabled: false,
                  createdAt: identity.resolvedAt,
                  updatedAt: identity.resolvedAt,
                })
                .onConflictDoNothing();
            }
          });
        },
        catch: (cause) =>
          new PersistenceFailure({
            message: "Failed to persist Intervals athlete identity",
            cause,
          }),
      });
    },
  };
}
