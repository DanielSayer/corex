import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { getLocalDateKey } from "../activity-history/activity-calendar";
import {
  paginateOffsetResults,
  toOffsetPaginationQuery,
} from "../application/pagination";
import type { PlanAdherenceService } from "../plan-adherence/service";
import type { PlanningDataService } from "../planning-data/service";
import type { TrainingSettingsService } from "../training-settings/service";
import type {
  FinalizedPlanHistory,
  FinalizeDraftInput,
  GenerationEventHistory,
  GenerateWeeklyDraftInput,
  ListGenerationEventsInput,
  ListFinalizedPlansInput,
  MoveDraftSessionInput,
  PlannerState,
  RegenerateDraftInput,
  UpdateDraftSessionInput,
  WeeklyPlanDraft,
  WeeklyPlan,
  WeeklyPlanFinalized,
  WeeklyPlanPayload,
} from "./contracts";
import {
  addDays,
  applyDraftSessionMove,
  applyDraftSessionUpdate,
  buildPlannerDefaults,
  createDraftGenerationContext,
  deriveCorexPerceivedAbility,
  plannerGoalOptions,
  validateGenerateWeeklyDraftInput,
} from "./domain";
import {
  moveDraftSessionInputSchema,
  finalizeDraftInputSchema,
  listGenerationEventsInputSchema,
  listFinalizedPlansInputSchema,
  regenerateDraftInputSchema,
  updateDraftSessionInputSchema,
} from "./contracts";
import type { PlannerModelPort } from "./model";
import type { WeeklyPlanningRepository } from "./repository";
import {
  DraftNotFound,
  DraftConflict,
  MissingTrainingSettings,
  MissingPriorPlan,
  NoLocalHistory,
  PlanFinalizationConflict,
  WeeklyPlanningValidationError,
} from "./errors";
import { createWeeklyPlanningGenerationRunner } from "./generation-runner";

type Clock = {
  now: () => Date;
};

function toDateOnly(now: Date) {
  return now.toISOString().slice(0, 10);
}

function toPlannerIntent(input: GenerateWeeklyDraftInput) {
  return input.planGoal === "race"
    ? {
        planGoal: input.planGoal,
        raceBenchmark: input.raceBenchmark,
      }
    : {
        planGoal: input.planGoal,
      };
}

export type WeeklyPlanningService = ReturnType<
  typeof createWeeklyPlanningService
>;

export function createWeeklyPlanningService(options: {
  trainingSettingsService: Pick<
    TrainingSettingsService,
    "getForUser" | "getTimezoneForUser"
  >;
  planningDataService: Pick<
    PlanningDataService,
    | "getPlanningHistorySnapshot"
    | "getHistoryQuality"
    | "getPlanningPerformanceSnapshot"
  >;
  repo: WeeklyPlanningRepository;
  model: PlannerModelPort;
  planAdherenceService?: Pick<PlanAdherenceService, "summaryForPlan">;
  clock?: Clock;
  idGenerator?: () => string;
}) {
  const clock = options.clock ?? { now: () => new Date() };
  const idGenerator = options.idGenerator ?? randomUUID;
  const generationRunner = createWeeklyPlanningGenerationRunner({
    repo: options.repo,
    model: options.model,
    clock,
    idGenerator,
  });

  function loadGenerationDependencies(userId: string) {
    return Effect.all([
      options.trainingSettingsService.getForUser(userId),
      options.planningDataService.getPlanningHistorySnapshot(userId),
      options.planningDataService.getHistoryQuality(userId),
      options.planningDataService.getPlanningPerformanceSnapshot(userId),
    ]);
  }

  function persistGeneratedDraft(input: {
    userId: string;
    goalId: string | null;
    parentWeeklyPlanId: string | null;
    generationContext: ReturnType<typeof createDraftGenerationContext>;
    rawOutputEffect: Effect.Effect<WeeklyPlanPayload, unknown, never>;
  }): Effect.Effect<WeeklyPlanDraft, unknown> {
    return generationRunner.persistGeneratedDraft(input);
  }

  function generateNextWeekFromPlan(
    userId: string,
    latestPlan: WeeklyPlan,
    generationDependencies: ReturnType<
      typeof loadGenerationDependencies
    > extends Effect.Effect<infer A, unknown, never>
      ? A
      : never,
  ): Effect.Effect<WeeklyPlanDraft, unknown> {
    return Effect.gen(function* () {
      const [settings, historySnapshot, historyQuality, performanceSnapshot] =
        generationDependencies;

      if (settings.status !== "complete" || !settings.availability) {
        return yield* Effect.fail(
          new MissingTrainingSettings({
            message: "Training settings must be completed before planning",
          }),
        );
      }

      if (!historyQuality.hasAnyHistory) {
        return yield* Effect.fail(
          new NoLocalHistory({
            message: "At least one imported run is required before planning",
          }),
        );
      }

      const startDate = addDays(latestPlan.endDate, 1);
      const existingDraft = yield* options.repo.getDraftForStartDate(
        userId,
        startDate,
      );

      if (existingDraft) {
        return yield* Effect.fail(
          new DraftConflict({
            message: "A weekly draft already exists for this start date",
          }),
        );
      }

      const availability = settings.availability;
      const derivedAbility = deriveCorexPerceivedAbility({
        historySnapshot,
        historyQuality,
        performanceSnapshot,
      });
      const previousContext = latestPlan.generationContext;
      const priorPlanAdherence =
        latestPlan.status === "finalized" && options.planAdherenceService
          ? yield* options.planAdherenceService.summaryForPlan(userId, {
              planId: latestPlan.id,
            })
          : null;
      const longRunDay = availability[previousContext.longRunDay].available
        ? previousContext.longRunDay
        : buildPlannerDefaults({
            availability,
            historyQuality,
            performanceSnapshot,
            startDate,
            derivedAbility,
          }).longRunDay;
      const generationContext = createDraftGenerationContext({
        plannerIntent: previousContext.plannerIntent,
        generationMode: "renewal",
        parentWeeklyPlanId: latestPlan.id,
        previousPlanWindow: {
          startDate: latestPlan.startDate,
          endDate: latestPlan.endDate,
        },
        priorPlanAdherence,
        currentDate: toDateOnly(clock.now()),
        availability,
        historySnapshot,
        historyQuality,
        performanceSnapshot,
        userPerceivedAbility: previousContext.userPerceivedAbility,
        corexPerceivedAbility: derivedAbility,
        longRunDay,
        startDate,
        planDurationWeeks: previousContext.planDurationWeeks,
      });

      return yield* persistGeneratedDraft({
        userId,
        goalId: latestPlan.goalId,
        parentWeeklyPlanId: latestPlan.id,
        generationContext,
        rawOutputEffect: options.model.generateWeeklyPlan(generationContext),
      });
    });
  }

  function replaceDraftWithGeneratedPayload(input: {
    userId: string;
    draftId: string;
    goalId: string | null;
    generationContext: ReturnType<typeof createDraftGenerationContext>;
    rawOutputEffect: Effect.Effect<WeeklyPlanPayload, unknown, never>;
  }): Effect.Effect<WeeklyPlanDraft, unknown> {
    return generationRunner.replaceDraftWithGeneratedPayload(input);
  }

  return {
    getState(userId: string): Effect.Effect<PlannerState, unknown> {
      return Effect.gen(function* () {
        const [
          settings,
          historySnapshot,
          historyQuality,
          performanceSnapshot,
          activeDraft,
          timezone,
        ] = yield* Effect.all([
          options.trainingSettingsService.getForUser(userId),
          options.planningDataService.getPlanningHistorySnapshot(userId),
          options.planningDataService.getHistoryQuality(userId),
          options.planningDataService.getPlanningPerformanceSnapshot(userId),
          options.repo.getActiveDraft(userId),
          options.trainingSettingsService.getTimezoneForUser(userId),
        ]);
        const today = getLocalDateKey(clock.now(), timezone);
        const currentFinalizedPlan =
          yield* options.repo.getFinalizedPlanForDate(userId, today);
        const currentFinalizedPlanAdherence =
          currentFinalizedPlan && options.planAdherenceService
            ? yield* options.planAdherenceService.summaryForPlan(userId, {
                planId: currentFinalizedPlan.id,
              })
            : null;

        const defaults =
          settings.status === "complete" && settings.availability
            ? buildPlannerDefaults({
                availability: settings.availability,
                historyQuality,
                performanceSnapshot,
                startDate: toDateOnly(clock.now()),
                derivedAbility: deriveCorexPerceivedAbility({
                  historySnapshot,
                  historyQuality,
                  performanceSnapshot,
                }),
              })
            : null;

        return {
          planGoalOptions: plannerGoalOptions,
          availability:
            settings.status === "complete" ? settings.availability : null,
          historySnapshot,
          historyQuality,
          performanceSnapshot,
          defaults,
          activeDraft,
          currentFinalizedPlan,
          currentFinalizedPlanAdherence,
        };
      });
    },
    finalizeDraft(
      userId: string,
      rawInput: FinalizeDraftInput,
    ): Effect.Effect<WeeklyPlanFinalized, unknown> {
      return Effect.gen(function* () {
        const input = yield* Effect.try({
          try: () => finalizeDraftInputSchema.parse(rawInput),
          catch: (error) =>
            new WeeklyPlanningValidationError({
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid draft finalization input",
            }),
        });
        const draft = yield* options.repo.getDraftById(userId, input.draftId);

        if (!draft) {
          return yield* Effect.fail(
            new DraftNotFound({
              message: "Weekly plan draft could not be found",
            }),
          );
        }

        const overlappingFinalized =
          yield* options.repo.findOverlappingFinalizedPlan(userId, {
            startDate: draft.startDate,
            endDate: draft.endDate,
          });

        if (overlappingFinalized) {
          return yield* Effect.fail(
            new PlanFinalizationConflict({
              message: "A finalized weekly plan already overlaps this draft",
            }),
          );
        }

        const finalized = yield* options.repo.finalizeDraft(userId, draft.id);

        if (!finalized) {
          return yield* Effect.fail(
            new DraftNotFound({
              message: "Weekly plan draft could not be found",
            }),
          );
        }

        return finalized;
      });
    },
    listFinalizedPlans(
      userId: string,
      rawInput: ListFinalizedPlansInput = {},
    ): Effect.Effect<FinalizedPlanHistory, unknown> {
      return Effect.gen(function* () {
        const input = yield* Effect.try({
          try: () => listFinalizedPlansInputSchema.parse(rawInput),
          catch: (error) =>
            new WeeklyPlanningValidationError({
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid finalized plan history input",
            }),
        });
        const items = yield* options.repo.listFinalizedPlans(userId, {
          ...toOffsetPaginationQuery(input),
        });

        return paginateOffsetResults(items, input);
      });
    },
    listGenerationEvents(
      userId: string,
      rawInput: ListGenerationEventsInput = {},
    ): Effect.Effect<GenerationEventHistory, unknown> {
      return Effect.gen(function* () {
        const input = yield* Effect.try({
          try: () => listGenerationEventsInputSchema.parse(rawInput),
          catch: (error) =>
            new WeeklyPlanningValidationError({
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid generation event history input",
            }),
        });
        const items = yield* options.repo.listGenerationEvents(userId, {
          ...toOffsetPaginationQuery(input),
        });

        return paginateOffsetResults(items, input);
      });
    },
    generateDraft(
      userId: string,
      rawInput: GenerateWeeklyDraftInput,
    ): Effect.Effect<WeeklyPlanDraft, unknown> {
      return Effect.gen(function* () {
        const input = yield* Effect.try({
          try: () => validateGenerateWeeklyDraftInput(rawInput),
          catch: (error) => error,
        });
        const [existingDraft, generationDependencies] = yield* Effect.all([
          options.repo.getDraftForStartDate(userId, input.startDate),
          loadGenerationDependencies(userId),
        ]);
        const [settings, historySnapshot, historyQuality, performanceSnapshot] =
          generationDependencies;

        if (existingDraft) {
          return yield* Effect.fail(
            new DraftConflict({
              message: "An active weekly draft already exists for this user",
            }),
          );
        }

        if (settings.status !== "complete" || !settings.availability) {
          return yield* Effect.fail(
            new MissingTrainingSettings({
              message: "Training settings must be completed before planning",
            }),
          );
        }

        if (!historyQuality.hasAnyHistory) {
          return yield* Effect.fail(
            new NoLocalHistory({
              message: "At least one imported run is required before planning",
            }),
          );
        }

        const availability = settings.availability;

        const derivedAbility = deriveCorexPerceivedAbility({
          historySnapshot,
          historyQuality,
          performanceSnapshot,
        });
        const generationContext = createDraftGenerationContext({
          plannerIntent: toPlannerIntent(input),
          generationMode: "initial",
          parentWeeklyPlanId: null,
          previousPlanWindow: null,
          priorPlanAdherence: null,
          currentDate: toDateOnly(clock.now()),
          availability,
          historySnapshot,
          historyQuality,
          performanceSnapshot,
          userPerceivedAbility: input.userPerceivedAbility,
          corexPerceivedAbility: derivedAbility,
          longRunDay: input.longRunDay,
          startDate: input.startDate,
          planDurationWeeks: input.planDurationWeeks,
        });

        return yield* persistGeneratedDraft({
          userId,
          goalId: null,
          parentWeeklyPlanId: null,
          generationContext,
          rawOutputEffect: options.model.generateWeeklyPlan(generationContext),
        });
      });
    },
    generateNextWeek(userId: string): Effect.Effect<WeeklyPlanDraft, unknown> {
      return Effect.gen(function* () {
        const [latestPlan, generationDependencies] = yield* Effect.all([
          options.repo.getLatestPlan(userId),
          loadGenerationDependencies(userId),
        ]);

        if (!latestPlan) {
          return yield* Effect.fail(
            new MissingPriorPlan({
              message:
                "A previous weekly plan is required before generating the next week",
            }),
          );
        }

        return yield* generateNextWeekFromPlan(
          userId,
          latestPlan,
          generationDependencies,
        );
      });
    },
    generateNextWeekFromLatestFinalized(
      userId: string,
    ): Effect.Effect<WeeklyPlanDraft, unknown> {
      return Effect.gen(function* () {
        const [latestPlan, generationDependencies] = yield* Effect.all([
          options.repo.getLatestPlan(userId),
          loadGenerationDependencies(userId),
        ]);

        if (!latestPlan || latestPlan.status !== "finalized") {
          return yield* Effect.fail(
            new MissingPriorPlan({
              message:
                "A latest finalized weekly plan is required before automatic renewal",
            }),
          );
        }

        return yield* generateNextWeekFromPlan(
          userId,
          latestPlan,
          generationDependencies,
        );
      });
    },
    updateDraftSession(
      userId: string,
      rawInput: UpdateDraftSessionInput,
    ): Effect.Effect<WeeklyPlanDraft, unknown> {
      return Effect.gen(function* () {
        const input = yield* Effect.try({
          try: () => updateDraftSessionInputSchema.parse(rawInput),
          catch: (error) =>
            new WeeklyPlanningValidationError({
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid draft session update input",
            }),
        });
        const draft = yield* options.repo.getDraftById(userId, input.draftId);

        if (!draft) {
          return yield* Effect.fail(
            new DraftNotFound({
              message: "Weekly plan draft could not be found",
            }),
          );
        }

        const payload = yield* Effect.try({
          try: () =>
            applyDraftSessionUpdate({
              payload: draft.payload,
              generationContext: draft.generationContext,
              date: input.date,
              session: input.session,
            }),
          catch: (error) => error,
        });
        const updated = yield* options.repo.updateDraftPayload({
          userId,
          draftId: draft.id,
          payload,
          qualityReport: generationRunner.createAdvisoryQualityReport({
            payload,
            generationContext: draft.generationContext,
          }),
        });

        if (!updated) {
          return yield* Effect.fail(
            new DraftNotFound({
              message: "Weekly plan draft could not be found",
            }),
          );
        }

        return updated;
      });
    },
    moveDraftSession(
      userId: string,
      rawInput: MoveDraftSessionInput,
    ): Effect.Effect<WeeklyPlanDraft, unknown> {
      return Effect.gen(function* () {
        const input = yield* Effect.try({
          try: () => moveDraftSessionInputSchema.parse(rawInput),
          catch: (error) =>
            new WeeklyPlanningValidationError({
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid draft session move input",
            }),
        });
        const draft = yield* options.repo.getDraftById(userId, input.draftId);

        if (!draft) {
          return yield* Effect.fail(
            new DraftNotFound({
              message: "Weekly plan draft could not be found",
            }),
          );
        }

        const payload = yield* Effect.try({
          try: () =>
            applyDraftSessionMove({
              payload: draft.payload,
              generationContext: draft.generationContext,
              fromDate: input.fromDate,
              toDate: input.toDate,
              mode: input.mode,
            }),
          catch: (error) => error,
        });
        const updated = yield* options.repo.updateDraftPayload({
          userId,
          draftId: draft.id,
          payload,
          qualityReport: generationRunner.createAdvisoryQualityReport({
            payload,
            generationContext: draft.generationContext,
          }),
        });

        if (!updated) {
          return yield* Effect.fail(
            new DraftNotFound({
              message: "Weekly plan draft could not be found",
            }),
          );
        }

        return updated;
      });
    },
    regenerateDraft(
      userId: string,
      rawInput: RegenerateDraftInput,
    ): Effect.Effect<WeeklyPlanDraft, unknown> {
      return Effect.gen(function* () {
        const input = yield* Effect.try({
          try: () => regenerateDraftInputSchema.parse(rawInput),
          catch: (error) =>
            new WeeklyPlanningValidationError({
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid draft regeneration input",
            }),
        });
        const [draft, generationDependencies] = yield* Effect.all([
          options.repo.getDraftById(userId, input.draftId),
          loadGenerationDependencies(userId),
        ]);
        const [settings, historySnapshot, historyQuality, performanceSnapshot] =
          generationDependencies;

        if (!draft) {
          return yield* Effect.fail(
            new DraftNotFound({
              message: "Weekly plan draft could not be found",
            }),
          );
        }

        if (settings.status !== "complete" || !settings.availability) {
          return yield* Effect.fail(
            new MissingTrainingSettings({
              message: "Training settings must be completed before planning",
            }),
          );
        }

        if (!historyQuality.hasAnyHistory) {
          return yield* Effect.fail(
            new NoLocalHistory({
              message: "At least one imported run is required before planning",
            }),
          );
        }

        const previousContext = draft.generationContext;
        const derivedAbility = deriveCorexPerceivedAbility({
          historySnapshot,
          historyQuality,
          performanceSnapshot,
        });
        const generationContext = createDraftGenerationContext({
          plannerIntent: previousContext.plannerIntent,
          generationMode: "regeneration",
          parentWeeklyPlanId: draft.parentWeeklyPlanId,
          previousPlanWindow: previousContext.previousPlanWindow,
          priorPlanAdherence: previousContext.priorPlanAdherence,
          currentDate: toDateOnly(clock.now()),
          availability: settings.availability,
          historySnapshot,
          historyQuality,
          performanceSnapshot,
          userPerceivedAbility: previousContext.userPerceivedAbility,
          corexPerceivedAbility: derivedAbility,
          longRunDay: previousContext.longRunDay,
          startDate: draft.startDate,
          planDurationWeeks: previousContext.planDurationWeeks,
        });

        return yield* replaceDraftWithGeneratedPayload({
          userId,
          draftId: draft.id,
          goalId: draft.goalId,
          generationContext,
          rawOutputEffect: options.model.generateWeeklyPlan(generationContext),
        });
      });
    },
  };
}
