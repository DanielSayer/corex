import { asc, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  intervalsCredential,
  trainingAvailability,
  trainingGoal,
} from "@corex/db/schema/training-settings";

import type { TrainingGoal, WeeklyAvailability } from "./contracts";
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
  goal: TrainingGoal;
  availability: WeeklyAvailability;
  intervalsCredential: StoredEncryptedCredential;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertTrainingSettingsRecord = {
  userId: string;
  goal: TrainingGoal;
  availability: WeeklyAvailability;
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
  upsert: (
    record: UpsertTrainingSettingsRecord,
  ) => Effect.Effect<StoredTrainingSettings, PersistenceFailure>;
  saveIntervalsAthleteIdentity: (
    userId: string,
    identity: {
      athleteId: string;
      resolvedAt: Date;
    },
  ) => Effect.Effect<void, PersistenceFailure>;
};

const dayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function mapGoalRow(row: typeof trainingGoal.$inferSelect): TrainingGoal {
  if (row.goalType === "event_goal") {
    if (
      row.targetDistanceValue == null ||
      row.targetDistanceUnit == null ||
      row.targetDate == null
    ) {
      throw new PersistenceFailure({
        message: "Stored event goal is incomplete",
      });
    }

    return {
      type: "event_goal",
      targetDistance: {
        value: row.targetDistanceValue,
        unit: row.targetDistanceUnit as "km" | "mi",
      },
      targetDate: row.targetDate,
      eventName: row.eventName ?? undefined,
      targetTimeSeconds: row.targetTimeSeconds ?? undefined,
      notes: row.notes ?? undefined,
    };
  }

  if (row.goalType === "volume_goal") {
    if (
      row.metric == null ||
      row.period == null ||
      row.targetValue == null ||
      row.unit == null
    ) {
      throw new PersistenceFailure({
        message: "Stored volume goal is incomplete",
      });
    }

    if (row.metric === "distance") {
      return {
        type: "volume_goal",
        metric: "distance",
        period: row.period as "week" | "month",
        targetValue: row.targetValue,
        unit: row.unit as "km" | "mi",
        notes: row.notes ?? undefined,
      };
    }

    return {
      type: "volume_goal",
      metric: "time",
      period: row.period as "week" | "month",
      targetValue: row.targetValue,
      unit: "minutes",
      notes: row.notes ?? undefined,
    };
  }

  throw new PersistenceFailure({
    message: "Stored goal type is unsupported",
  });
}

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

function buildGoalInsert(record: UpsertTrainingSettingsRecord) {
  type TrainingGoalInsert = typeof trainingGoal.$inferInsert;

  const common = {
    userId: record.userId,
    notes: record.goal.notes ?? null,
  };

  if (record.goal.type === "event_goal") {
    return {
      ...common,
      goalType: "event_goal",
      metric: null,
      period: null,
      targetValue: null,
      unit: null,
      targetDistanceValue: record.goal.targetDistance.value,
      targetDistanceUnit: record.goal.targetDistance.unit,
      targetDate: record.goal.targetDate,
      eventName: record.goal.eventName ?? null,
      targetTimeSeconds: record.goal.targetTimeSeconds ?? null,
    } satisfies TrainingGoalInsert;
  }

  return {
    ...common,
    goalType: "volume_goal",
    metric: record.goal.metric,
    period: record.goal.period,
    targetValue: record.goal.targetValue,
    unit: record.goal.unit,
    targetDistanceValue: null,
    targetDistanceUnit: null,
    targetDate: null,
    eventName: null,
    targetTimeSeconds: null,
  } satisfies TrainingGoalInsert;
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

function mapStoredAggregate(
  userId: string,
  goalRow: typeof trainingGoal.$inferSelect | undefined,
  availabilityRows: Array<typeof trainingAvailability.$inferSelect>,
  credentialRow: typeof intervalsCredential.$inferSelect | undefined,
): StoredTrainingSettings | null {
  if (!goalRow && availabilityRows.length === 0 && !credentialRow) {
    return null;
  }

  if (!goalRow || availabilityRows.length === 0 || !credentialRow) {
    throw new PersistenceFailure({
      message: "Stored training profile is incomplete",
    });
  }

  return {
    userId,
    goal: mapGoalRow(goalRow),
    availability: mapAvailabilityRows(availabilityRows),
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
    createdAt: goalRow.createdAt,
    updatedAt: [
      goalRow.updatedAt,
      credentialRow.updatedAt,
      ...availabilityRows.map((row) => row.updatedAt),
    ].reduce((latest, current) => (current > latest ? current : latest)),
  };
}

async function findStoredTrainingSettings(db: Database, userId: string) {
  const [goalRow, availabilityRows, credentialRow] = await Promise.all([
    db.query.trainingGoal.findFirst({
      where: eq(trainingGoal.userId, userId),
    }),
    db.query.trainingAvailability.findMany({
      where: eq(trainingAvailability.userId, userId),
      orderBy: asc(trainingAvailability.dayOfWeek),
    }),
    db.query.intervalsCredential.findFirst({
      where: eq(intervalsCredential.userId, userId),
    }),
  ]);

  return mapStoredAggregate(userId, goalRow, availabilityRows, credentialRow);
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
    upsert(record) {
      return Effect.tryPromise({
        try: async () => {
          const now = new Date();
          await db.transaction(async (tx) => {
            await tx
              .insert(trainingGoal)
              .values({
                ...buildGoalInsert(record),
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: trainingGoal.userId,
                set: {
                  ...buildGoalInsert(record),
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
              message: "Persisted training profile could not be reloaded",
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
    saveIntervalsAthleteIdentity(userId, identity) {
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
          new PersistenceFailure({
            message: "Failed to persist Intervals athlete identity",
            cause,
          }),
      });
    },
  };
}
