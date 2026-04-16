import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { generationEvent, weeklyPlan } from "@corex/db/schema/weekly-planning";

import type {
  DraftGenerationContext,
  GenerationFailureCategory,
  PlanQualityReport,
  WeeklyPlan,
  WeeklyPlanDraft,
  WeeklyPlanPayload,
} from "./contracts";
import { weeklyPlanDraftSchema, weeklyPlanSchema } from "./contracts";
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
  qualityReport: PlanQualityReport | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WeeklyPlanningRepository = {
  getActiveDraft: (
    userId: string,
  ) => Effect.Effect<WeeklyPlanDraft | null, WeeklyPlanningPersistenceFailure>;
  getLatestPlan: (
    userId: string,
  ) => Effect.Effect<WeeklyPlan | null, WeeklyPlanningPersistenceFailure>;
  getDraftForStartDate: (
    userId: string,
    startDate: string,
  ) => Effect.Effect<WeeklyPlanDraft | null, WeeklyPlanningPersistenceFailure>;
  getDraftById: (
    userId: string,
    draftId: string,
  ) => Effect.Effect<WeeklyPlanDraft | null, WeeklyPlanningPersistenceFailure>;
  getPlanForDate: (
    userId: string,
    date: string,
  ) => Effect.Effect<WeeklyPlan | null, WeeklyPlanningPersistenceFailure>;
  listPlansInRange: (
    userId: string,
    input: { startDate: string; endDate: string },
  ) => Effect.Effect<WeeklyPlan[], WeeklyPlanningPersistenceFailure>;
  createDraft: (input: {
    id: string;
    userId: string;
    goalId: string | null;
    parentWeeklyPlanId: string | null;
    startDate: string;
    endDate: string;
    generationContext: DraftGenerationContext;
    payload: WeeklyPlanPayload;
    qualityReport?: PlanQualityReport | null;
  }) => Effect.Effect<WeeklyPlanDraft, WeeklyPlanningPersistenceFailure>;
  updateDraftPayload: (input: {
    userId: string;
    draftId: string;
    payload: WeeklyPlanPayload;
    qualityReport?: PlanQualityReport | null;
  }) => Effect.Effect<WeeklyPlanDraft | null, WeeklyPlanningPersistenceFailure>;
  replaceDraftGeneration: (input: {
    userId: string;
    draftId: string;
    generationContext: DraftGenerationContext;
    payload: WeeklyPlanPayload;
    qualityReport?: PlanQualityReport | null;
  }) => Effect.Effect<WeeklyPlanDraft | null, WeeklyPlanningPersistenceFailure>;
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
    qualityReport?: PlanQualityReport | null;
  }) => Effect.Effect<StoredGenerationEvent, WeeklyPlanningPersistenceFailure>;
};

function mapWeeklyPlan(row: typeof weeklyPlan.$inferSelect): WeeklyPlan {
  const parsed = weeklyPlanSchema.safeParse({
    id: row.id,
    userId: row.userId,
    goalId: row.goalId,
    parentWeeklyPlanId: row.parentWeeklyPlanId,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    generationContext: row.generationContext,
    payload: row.payload,
    qualityReport: row.qualityReport,
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

function mapDraft(row: typeof weeklyPlan.$inferSelect): WeeklyPlanDraft {
  const parsed = weeklyPlanDraftSchema.safeParse(mapWeeklyPlan(row));

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
    qualityReport: row.qualityReport as PlanQualityReport | null,
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
            orderBy: desc(weeklyPlan.startDate),
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
    getLatestPlan(userId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.weeklyPlan.findFirst({
            where: eq(weeklyPlan.userId, userId),
            orderBy: [desc(weeklyPlan.startDate), desc(weeklyPlan.createdAt)],
          });

          return row ? mapWeeklyPlan(row) : null;
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to load latest weekly plan",
                cause,
              }),
      });
    },
    getDraftForStartDate(userId, startDate) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.weeklyPlan.findFirst({
            where: and(
              eq(weeklyPlan.userId, userId),
              eq(weeklyPlan.status, "draft"),
              eq(weeklyPlan.startDate, startDate),
            ),
          });

          return row ? mapDraft(row) : null;
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to load weekly plan draft for start date",
                cause,
              }),
      });
    },
    getDraftById(userId, draftId) {
      return Effect.tryPromise({
        try: async () => {
          const row = await db.query.weeklyPlan.findFirst({
            where: and(
              eq(weeklyPlan.userId, userId),
              eq(weeklyPlan.id, draftId),
              eq(weeklyPlan.status, "draft"),
            ),
          });

          return row ? mapDraft(row) : null;
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to load weekly plan draft",
                cause,
              }),
      });
    },
    getPlanForDate(userId, date) {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db.query.weeklyPlan.findMany({
            where: and(
              eq(weeklyPlan.userId, userId),
              lte(weeklyPlan.startDate, date),
              gte(weeklyPlan.endDate, date),
            ),
            orderBy: [desc(weeklyPlan.status), desc(weeklyPlan.startDate)],
          });

          const row =
            rows.find((candidate) => candidate.status === "draft") ?? rows[0];
          return row ? mapDraft(row) : null;
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to load weekly plan for date",
                cause,
              }),
      });
    },
    listPlansInRange(userId, input) {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db.query.weeklyPlan.findMany({
            where: and(
              eq(weeklyPlan.userId, userId),
              lte(weeklyPlan.startDate, input.endDate),
              gte(weeklyPlan.endDate, input.startDate),
            ),
            orderBy: [asc(weeklyPlan.startDate), asc(weeklyPlan.createdAt)],
          });

          const plansByStartDate = new Map<string, (typeof rows)[number]>();

          for (const row of rows) {
            const existing = plansByStartDate.get(row.startDate);

            if (
              !existing ||
              (existing.status !== "draft" && row.status === "draft")
            ) {
              plansByStartDate.set(row.startDate, row);
            }
          }

          return [...plansByStartDate.values()].map(mapWeeklyPlan);
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to list weekly plans in range",
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
              parentWeeklyPlanId: input.parentWeeklyPlanId,
              status: "draft",
              startDate: input.startDate,
              endDate: input.endDate,
              generationContext: input.generationContext,
              payload: input.payload,
              qualityReport: input.qualityReport ?? null,
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
    updateDraftPayload(input) {
      return Effect.tryPromise({
        try: async () => {
          const [row] = await db
            .update(weeklyPlan)
            .set({
              payload: input.payload,
              qualityReport: input.qualityReport ?? null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(weeklyPlan.userId, input.userId),
                eq(weeklyPlan.id, input.draftId),
                eq(weeklyPlan.status, "draft"),
              ),
            )
            .returning();

          return row ? mapDraft(row) : null;
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to update weekly plan draft payload",
                cause,
              }),
      });
    },
    replaceDraftGeneration(input) {
      return Effect.tryPromise({
        try: async () => {
          const [row] = await db
            .update(weeklyPlan)
            .set({
              generationContext: input.generationContext,
              payload: input.payload,
              qualityReport: input.qualityReport ?? null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(weeklyPlan.userId, input.userId),
                eq(weeklyPlan.id, input.draftId),
                eq(weeklyPlan.status, "draft"),
              ),
            )
            .returning();

          return row ? mapDraft(row) : null;
        },
        catch: (cause) =>
          cause instanceof WeeklyPlanningPersistenceFailure
            ? cause
            : new WeeklyPlanningPersistenceFailure({
                message: "Failed to replace weekly plan draft generation",
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
              qualityReport: input.qualityReport ?? null,
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
