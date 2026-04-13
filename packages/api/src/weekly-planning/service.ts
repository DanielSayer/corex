import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import type { PlanningDataService } from "../planning-data/service";
import type { TrainingSettingsService } from "../training-settings/service";
import type {
  GenerateWeeklyDraftInput,
  PlannerState,
  WeeklyPlanDraft,
  WeeklyPlanPayload,
} from "./contracts";
import {
  addDays,
  buildPlannerDefaults,
  createDraftGenerationContext,
  deriveCorexPerceivedAbility,
  plannerGoalOptions,
  validateGeneratedPayload,
  validateGenerateWeeklyDraftInput,
} from "./domain";
import type { PlannerModelPort } from "./model";
import type { WeeklyPlanningRepository } from "./repository";
import {
  DraftConflict,
  MissingTrainingSettings,
  MissingPriorPlan,
  NoLocalHistory,
  toFailureCategory,
} from "./errors";

type Clock = {
  now: () => Date;
};

function toDateOnly(now: Date) {
  return now.toISOString().slice(0, 10);
}

function toFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
  trainingSettingsService: Pick<TrainingSettingsService, "getForUser">;
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
        ] = yield* Effect.all([
          options.trainingSettingsService.getForUser(userId),
          options.planningDataService.getPlanningHistorySnapshot(userId),
          options.planningDataService.getHistoryQuality(userId),
          options.planningDataService.getPlanningPerformanceSnapshot(userId),
          options.repo.getActiveDraft(userId),
        ]);

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
  };
}
