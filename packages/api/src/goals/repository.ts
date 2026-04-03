import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { trainingGoal } from "@corex/db/schema/training-settings";

import type { TrainingGoal } from "../training-settings/contracts";
import { PersistenceFailure } from "../training-settings/errors";

export type StoredGoal = {
  id: string;
  userId: string;
  goal: TrainingGoal;
  createdAt: Date;
  updatedAt: Date;
};

export type GoalRepository = {
  listByUserId: (
    userId: string,
  ) => Effect.Effect<StoredGoal[], PersistenceFailure>;
  create: (record: {
    id: string;
    userId: string;
    goal: TrainingGoal;
  }) => Effect.Effect<StoredGoal, PersistenceFailure>;
  update: (record: {
    id: string;
    userId: string;
    goal: TrainingGoal;
  }) => Effect.Effect<StoredGoal, PersistenceFailure>;
};

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

function mapStoredGoal(row: typeof trainingGoal.$inferSelect): StoredGoal {
  return {
    id: row.id,
    userId: row.userId,
    goal: mapGoalRow(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildGoalValues(record: {
  id: string;
  userId: string;
  goal: TrainingGoal;
}) {
  if (record.goal.type === "event_goal") {
    return {
      id: record.id,
      userId: record.userId,
      goalType: "event_goal" as const,
      metric: null,
      period: null,
      targetValue: null,
      unit: null,
      targetDistanceValue: record.goal.targetDistance.value,
      targetDistanceUnit: record.goal.targetDistance.unit,
      targetDate: record.goal.targetDate,
      eventName: record.goal.eventName ?? null,
      targetTimeSeconds: record.goal.targetTimeSeconds ?? null,
      notes: record.goal.notes ?? null,
    };
  }

  return {
    id: record.id,
    userId: record.userId,
    goalType: "volume_goal" as const,
    metric: record.goal.metric,
    period: record.goal.period,
    targetValue: record.goal.targetValue,
    unit: record.goal.unit,
    targetDistanceValue: null,
    targetDistanceUnit: null,
    targetDate: null,
    eventName: null,
    targetTimeSeconds: null,
    notes: record.goal.notes ?? null,
  };
}

export function createGoalRepository(db: Database): GoalRepository {
  return {
    listByUserId(userId) {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db.query.trainingGoal.findMany({
            where: eq(trainingGoal.userId, userId),
            orderBy: [desc(trainingGoal.createdAt), desc(trainingGoal.id)],
          });

          return rows.map(mapStoredGoal);
        },
        catch: (cause) =>
          new PersistenceFailure({
            message: "Failed to load goals",
            cause,
          }),
      });
    },
    create(record) {
      return Effect.tryPromise({
        try: async () => {
          const [created] = await db
            .insert(trainingGoal)
            .values(buildGoalValues(record))
            .returning();

          if (!created) {
            throw new PersistenceFailure({
              message: "Created goal could not be reloaded",
            });
          }

          return mapStoredGoal(created);
        },
        catch: (cause) =>
          cause instanceof PersistenceFailure
            ? cause
            : new PersistenceFailure({
                message: "Failed to create goal",
                cause,
              }),
      });
    },
    update(record) {
      return Effect.tryPromise({
        try: async () => {
          const [updated] = await db
            .update(trainingGoal)
            .set({
              ...buildGoalValues(record),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(trainingGoal.id, record.id),
                eq(trainingGoal.userId, record.userId),
              ),
            )
            .returning();

          if (!updated) {
            throw new PersistenceFailure({
              message: "Goal could not be found",
            });
          }

          return mapStoredGoal(updated);
        },
        catch: (cause) =>
          cause instanceof PersistenceFailure
            ? cause
            : new PersistenceFailure({
                message: "Failed to update goal",
                cause,
              }),
      });
    },
  };
}
