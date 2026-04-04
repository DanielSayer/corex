import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { generationEvent, weeklyPlan } from "@corex/db/schema/weekly-planning";

import type {
  DraftGenerationContext,
  GenerationFailureCategory,
  WeeklyPlanDraft,
  WeeklyPlanPayload,
} from "./contracts";
import { weeklyPlanDraftSchema } from "./contracts";
import { WeeklyPlanningPersistenceFailure } from "./errors";

export type StoredGenerationEvent = {
  id: string;
  userId: string;
  goalId: string | null;
  weeklyPlanId: string | null;
  status: "success" | "failure";
  provider: string;
  model: string;
  startDate: string;
  failureCategory: GenerationFailureCategory | null;
  failureMessage: string | null;
  generationContext: DraftGenerationContext;
  modelOutput: unknown | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WeeklyPlanningRepository = {
  getActiveDraft: (
    userId: string,
  ) => Effect.Effect<WeeklyPlanDraft | null, WeeklyPlanningPersistenceFailure>;
  createDraft: (input: {
    id: string;
    userId: string;
    goalId: string;
    startDate: string;
    endDate: string;
    generationContext: DraftGenerationContext;
    payload: WeeklyPlanPayload;
  }) => Effect.Effect<WeeklyPlanDraft, WeeklyPlanningPersistenceFailure>;
  recordGenerationEvent: (input: {
    id: string;
    userId: string;
    goalId: string | null;
    weeklyPlanId: string | null;
    status: "success" | "failure";
    provider: string;
    model: string;
    startDate: string;
    failureCategory: GenerationFailureCategory | null;
    failureMessage: string | null;
    generationContext: DraftGenerationContext;
    modelOutput: unknown | null;
  }) => Effect.Effect<StoredGenerationEvent, WeeklyPlanningPersistenceFailure>;
};

function mapDraft(row: typeof weeklyPlan.$inferSelect): WeeklyPlanDraft {
  const parsed = weeklyPlanDraftSchema.safeParse({
    id: row.id,
    userId: row.userId,
    goalId: row.goalId,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    generationContext: row.generationContext,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

  if (!parsed.success) {
    throw new WeeklyPlanningPersistenceFailure({
      message: "Persisted weekly plan draft was invalid",
      cause: parsed.error,
    });
  }

  return parsed.data;
}

function mapGenerationEvent(
  row: typeof generationEvent.$inferSelect,
): StoredGenerationEvent {
  return {
    id: row.id,
    userId: row.userId,
    goalId: row.goalId,
    weeklyPlanId: row.weeklyPlanId,
    status: row.status,
    provider: row.provider,
    model: row.model,
    startDate: row.startDate,
    failureCategory:
      (row.failureCategory as GenerationFailureCategory | null) ?? null,
    failureMessage: row.failureMessage,
    generationContext: row.generationContext as DraftGenerationContext,
    modelOutput: row.modelOutput,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createWeeklyPlanningRepository(
  db: Database,
): WeeklyPlanningRepository {
  return {
    getActiveDraft(userId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.weeklyPlan.findFirst({
            where: and(
              eq(weeklyPlan.userId, userId),
              eq(weeklyPlan.status, "draft"),
            ),
            orderBy: desc(weeklyPlan.createdAt),
          });

          return row ? mapDraft(row) : null;
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to load active weekly plan draft",
                cause,
              }),
      });
    },
    createDraft(input) {
      return Effect.tryPromise({
        try: async () => {
          const [row] = await db
            .insert(weeklyPlan)
            .values({
              id: input.id,
              userId: input.userId,
              goalId: input.goalId,
              status: "draft",
              startDate: input.startDate,
              endDate: input.endDate,
              generationContext: input.generationContext,
              payload: input.payload,
            })
            .returning();

          if (!row) {
            throw new WeeklyPlanningPersistenceFailure({
              message: "Created weekly plan draft could not be reloaded",
            });
          }

          return mapDraft(row);
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to persist weekly plan draft",
                cause,
              }),
      });
    },
    recordGenerationEvent(input) {
      return Effect.tryPromise({
        try: async () => {
          const [row] = await db
            .insert(generationEvent)
            .values({
              id: input.id,
              userId: input.userId,
              goalId: input.goalId,
              weeklyPlanId: input.weeklyPlanId,
              status: input.status,
              provider: input.provider,
              model: input.model,
              startDate: input.startDate,
              failureCategory: input.failureCategory,
              failureMessage: input.failureMessage,
              generationContext: input.generationContext,
              modelOutput: input.modelOutput,
            })
            .returning();

          if (!row) {
            throw new WeeklyPlanningPersistenceFailure({
              message: "Generation event could not be reloaded",
            });
          }

          return mapGenerationEvent(row);
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to persist generation event",
                cause,
              }),
      });
    },
  };
}
