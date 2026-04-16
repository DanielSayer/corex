import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { getLocalDateKey } from "../activity-history/activity-calendar";
import type { PlanningDataService } from "../planning-data/service";
import type { TrainingSettingsService } from "../training-settings/service";
import type {
  FinalizedPlanHistory,
  FinalizeDraftInput,
  GenerateWeeklyDraftInput,
  ListFinalizedPlansInput,
  MoveDraftSessionInput,
  PlanQualityReport,
  PlannerState,
  RegenerateDraftInput,
  UpdateDraftSessionInput,
  WeeklyPlanDraft,
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
  validateGeneratedPayload,
  validateGenerateWeeklyDraftInput,
} from "./domain";
import {
  moveDraftSessionInputSchema,
  finalizeDraftInputSchema,
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
  PlanQualityGuardrailFailure,
  WeeklyPlanningValidationError,
  toFailureCategory,
} from "./errors";
import { reviewPlanQuality } from "./quality-review";

type Clock = {
  now: () => Date;
};

function toDateOnly(now: Date) {
  return now.toISOString().slice(0, 10);
}

function toFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createGeneratedAt(clock: Clock) {
  return clock.now().toISOString();
}

function createQualityGuardrailFailure(report: PlanQualityReport) {
  return new PlanQualityGuardrailFailure({
    message: report.summary,
  });
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
  clock?: Clock;
  idGenerator?: () => string;
}) {
  const clock = options.clock ?? { now: () => new Date() };
  const idGenerator = options.idGenerator ?? randomUUID;

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
    return Effect.gen(function* () {
      const output = yield* Effect.catchAll(input.rawOutputEffect, (error) =>
        Effect.gen(function* () {
          yield* options.repo.recordGenerationEvent({
            id: idGenerator(),
            userId: input.userId,
            goalId: input.goalId,
            weeklyPlanId: null,
            status: "failure",
            provider: options.model.provider,
            model: options.model.model,
            startDate: input.generationContext.startDate,
            failureCategory: toFailureCategory(error),
            failureMessage: toFailureMessage(error),
            generationContext: input.generationContext,
            modelOutput: null,
          });

          return yield* Effect.fail(error);
        }),
      );

      const payload = yield* Effect.catchAll(
        Effect.try({
          try: () =>
            validateGeneratedPayload({
              payload: output,
              availability: input.generationContext.availability,
              longRunDay: input.generationContext.longRunDay,
              startDate: input.generationContext.startDate,
            }),
          catch: (error) => error,
        }),
        (error) =>
          Effect.gen(function* () {
            yield* options.repo.recordGenerationEvent({
              id: idGenerator(),
              userId: input.userId,
              goalId: input.goalId,
              weeklyPlanId: null,
              status: "failure",
              provider: options.model.provider,
              model: options.model.model,
              startDate: input.generationContext.startDate,
              failureCategory: toFailureCategory(error),
              failureMessage: toFailureMessage(error),
              generationContext: input.generationContext,
              modelOutput: output,
            });

            return yield* Effect.fail(error);
          }),
      );

      const qualityReport = reviewPlanQuality({
        payload,
        generationContext: input.generationContext,
        mode: "enforced",
        generatedAt: createGeneratedAt(clock),
      });

      if (qualityReport.status === "blocked") {
        const error = createQualityGuardrailFailure(qualityReport);

        yield* options.repo.recordGenerationEvent({
          id: idGenerator(),
          userId: input.userId,
          goalId: input.goalId,
          weeklyPlanId: null,
          status: "failure",
          provider: options.model.provider,
          model: options.model.model,
          startDate: input.generationContext.startDate,
          failureCategory: toFailureCategory(error),
          failureMessage: toFailureMessage(error),
          generationContext: input.generationContext,
          modelOutput: payload,
          qualityReport,
        });

        return yield* Effect.fail(error);
      }

      const draft = yield* Effect.catchAll(
        options.repo.createDraft({
          id: idGenerator(),
          userId: input.userId,
          goalId: input.goalId,
          parentWeeklyPlanId: input.parentWeeklyPlanId,
          startDate: input.generationContext.startDate,
          endDate: input.generationContext.endDate,
          generationContext: input.generationContext,
          payload,
          qualityReport,
        }),
        (error) =>
          Effect.gen(function* () {
            yield* options.repo.recordGenerationEvent({
              id: idGenerator(),
              userId: input.userId,
              goalId: input.goalId,
              weeklyPlanId: null,
              status: "failure",
              provider: options.model.provider,
              model: options.model.model,
              startDate: input.generationContext.startDate,
              failureCategory: toFailureCategory(error),
              failureMessage: toFailureMessage(error),
              generationContext: input.generationContext,
              modelOutput: payload,
              qualityReport,
            });

            return yield* Effect.fail(error);
          }),
      );

      yield* options.repo.recordGenerationEvent({
        id: idGenerator(),
        userId: input.userId,
        goalId: input.goalId,
        weeklyPlanId: draft.id,
        status: "success",
        provider: options.model.provider,
        model: options.model.model,
        startDate: input.generationContext.startDate,
        failureCategory: null,
        failureMessage: null,
        generationContext: input.generationContext,
        modelOutput: payload,
        qualityReport,
      });

      return draft;
    });
  }

  function replaceDraftWithGeneratedPayload(input: {
    userId: string;
    draftId: string;
    goalId: string | null;
    generationContext: ReturnType<typeof createDraftGenerationContext>;
    rawOutputEffect: Effect.Effect<WeeklyPlanPayload, unknown, never>;
  }): Effect.Effect<WeeklyPlanDraft, unknown> {
    return Effect.gen(function* () {
      const output = yield* Effect.catchAll(input.rawOutputEffect, (error) =>
        Effect.gen(function* () {
          yield* options.repo.recordGenerationEvent({
            id: idGenerator(),
            userId: input.userId,
            goalId: input.goalId,
            weeklyPlanId: input.draftId,
            status: "failure",
            provider: options.model.provider,
            model: options.model.model,
            startDate: input.generationContext.startDate,
            failureCategory: toFailureCategory(error),
            failureMessage: toFailureMessage(error),
            generationContext: input.generationContext,
            modelOutput: null,
          });

          return yield* Effect.fail(error);
        }),
      );

      const payload = yield* Effect.catchAll(
        Effect.try({
          try: () =>
            validateGeneratedPayload({
              payload: output,
              availability: input.generationContext.availability,
              longRunDay: input.generationContext.longRunDay,
              startDate: input.generationContext.startDate,
            }),
          catch: (error) => error,
        }),
        (error) =>
          Effect.gen(function* () {
            yield* options.repo.recordGenerationEvent({
              id: idGenerator(),
              userId: input.userId,
              goalId: input.goalId,
              weeklyPlanId: input.draftId,
              status: "failure",
              provider: options.model.provider,
              model: options.model.model,
              startDate: input.generationContext.startDate,
              failureCategory: toFailureCategory(error),
              failureMessage: toFailureMessage(error),
              generationContext: input.generationContext,
              modelOutput: output,
            });

            return yield* Effect.fail(error);
          }),
      );

      const qualityReport = reviewPlanQuality({
        payload,
        generationContext: input.generationContext,
        mode: "enforced",
        generatedAt: createGeneratedAt(clock),
      });

      if (qualityReport.status === "blocked") {
        const error = createQualityGuardrailFailure(qualityReport);

        yield* options.repo.recordGenerationEvent({
          id: idGenerator(),
          userId: input.userId,
          goalId: input.goalId,
          weeklyPlanId: input.draftId,
          status: "failure",
          provider: options.model.provider,
          model: options.model.model,
          startDate: input.generationContext.startDate,
          failureCategory: toFailureCategory(error),
          failureMessage: toFailureMessage(error),
          generationContext: input.generationContext,
          modelOutput: payload,
          qualityReport,
        });

        return yield* Effect.fail(error);
      }

      const draft = yield* Effect.catchAll(
        Effect.gen(function* () {
          const updated = yield* options.repo.replaceDraftGeneration({
            userId: input.userId,
            draftId: input.draftId,
            generationContext: input.generationContext,
            payload,
            qualityReport,
          });

          if (!updated) {
            return yield* Effect.fail(
              new DraftNotFound({
                message: "Weekly plan draft could not be found",
              }),
            );
          }

          return updated;
        }),
        (error) =>
          Effect.gen(function* () {
            yield* options.repo.recordGenerationEvent({
              id: idGenerator(),
              userId: input.userId,
              goalId: input.goalId,
              weeklyPlanId: input.draftId,
              status: "failure",
              provider: options.model.provider,
              model: options.model.model,
              startDate: input.generationContext.startDate,
              failureCategory: toFailureCategory(error),
              failureMessage: toFailureMessage(error),
              generationContext: input.generationContext,
              modelOutput: payload,
              qualityReport,
            });

            return yield* Effect.fail(error);
          }),
      );

      yield* options.repo.recordGenerationEvent({
        id: idGenerator(),
        userId: input.userId,
        goalId: input.goalId,
        weeklyPlanId: draft.id,
        status: "success",
        provider: options.model.provider,
        model: options.model.model,
        startDate: input.generationContext.startDate,
        failureCategory: null,
        failureMessage: null,
        generationContext: input.generationContext,
        modelOutput: payload,
        qualityReport,
      });

      return draft;
    });
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
          limit: input.limit + 1,
          offset: input.offset,
        });
        const visibleItems = items.slice(0, input.limit);

        return {
          items: visibleItems,
          nextOffset:
            items.length > input.limit ? input.offset + input.limit : null,
        };
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
        const [settings, historySnapshot, historyQuality, performanceSnapshot] =
          generationDependencies;

        if (!latestPlan) {
          return yield* Effect.fail(
            new MissingPriorPlan({
              message:
                "A previous weekly plan is required before generating the next week",
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
          qualityReport: reviewPlanQuality({
            payload,
            generationContext: draft.generationContext,
            mode: "advisory",
            generatedAt: createGeneratedAt(clock),
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
          qualityReport: reviewPlanQuality({
            payload,
            generationContext: draft.generationContext,
            mode: "advisory",
            generatedAt: createGeneratedAt(clock),
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
