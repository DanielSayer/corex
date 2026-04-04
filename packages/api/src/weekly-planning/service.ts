import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import type { GoalsApi } from "../goals/service";
import type { PlanningDataService } from "../planning-data/service";
import type { TrainingSettingsService } from "../training-settings/service";
import type {
  GenerateWeeklyDraftInput,
  PlannerState,
  WeeklyPlanDraft,
} from "./contracts";
import {
  buildPlannerDefaults,
  createDraftGenerationContext,
  deriveCorexPerceivedAbility,
  validateGeneratedPayload,
  validateGenerateWeeklyDraftInput,
} from "./domain";
import type { PlannerModelPort } from "./model";
import type { WeeklyPlanningRepository } from "./repository";
import {
  DraftConflict,
  MissingGoal,
  MissingTrainingSettings,
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

export type WeeklyPlanningService = ReturnType<
  typeof createWeeklyPlanningService
>;

export function createWeeklyPlanningService(options: {
  goalsApi: Pick<GoalsApi, "getForUser">;
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

  return {
    getState(userId: string): Effect.Effect<PlannerState, unknown> {
      return Effect.gen(function* () {
        const [
          goals,
          settings,
          historySnapshot,
          historyQuality,
          performanceSnapshot,
          activeDraft,
        ] = yield* Effect.all([
          options.goalsApi.getForUser(userId),
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
          goalCandidates: goals,
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
        const [
          existingDraft,
          goals,
          settings,
          historySnapshot,
          historyQuality,
          performanceSnapshot,
        ] = yield* Effect.all([
          options.repo.getActiveDraft(userId),
          options.goalsApi.getForUser(userId),
          options.trainingSettingsService.getForUser(userId),
          options.planningDataService.getPlanningHistorySnapshot(userId),
          options.planningDataService.getHistoryQuality(userId),
          options.planningDataService.getPlanningPerformanceSnapshot(userId),
        ]);

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

        const goal = goals.find((candidate) => candidate.id === input.goalId);

        if (!goal) {
          return yield* Effect.fail(
            new MissingGoal({
              message: "Selected goal could not be found",
            }),
          );
        }

        const derivedAbility = deriveCorexPerceivedAbility({
          historySnapshot,
          historyQuality,
          performanceSnapshot,
        });
        const generationContext = createDraftGenerationContext({
          goal,
          availability,
          historySnapshot,
          historyQuality,
          performanceSnapshot,
          userPerceivedAbility: input.userPerceivedAbility,
          corexPerceivedAbility: derivedAbility,
          estimatedRaceDistance: input.estimatedRaceDistance,
          estimatedRaceTimeSeconds: input.estimatedRaceTimeSeconds,
          longRunDay: input.longRunDay,
          startDate: input.startDate,
          planDurationWeeks: input.planDurationWeeks,
        });

        const output = yield* Effect.catchAll(
          options.model.generateWeeklyPlan(generationContext),
          (error) =>
            Effect.gen(function* () {
              yield* options.repo.recordGenerationEvent({
                id: idGenerator(),
                userId,
                goalId: goal.id,
                weeklyPlanId: null,
                status: "failure",
                provider: options.model.provider,
                model: options.model.model,
                startDate: input.startDate,
                failureCategory: toFailureCategory(error),
                failureMessage: toFailureMessage(error),
                generationContext,
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
                availability,
                longRunDay: input.longRunDay,
                startDate: input.startDate,
              }),
            catch: (error) => error,
          }),
          (error) =>
            Effect.gen(function* () {
              yield* options.repo.recordGenerationEvent({
                id: idGenerator(),
                userId,
                goalId: goal.id,
                weeklyPlanId: null,
                status: "failure",
                provider: options.model.provider,
                model: options.model.model,
                startDate: input.startDate,
                failureCategory: toFailureCategory(error),
                failureMessage: toFailureMessage(error),
                generationContext,
                modelOutput: output,
              });

              return yield* Effect.fail(error);
            }),
        );
        const draft = yield* Effect.catchAll(
          options.repo.createDraft({
            id: idGenerator(),
            userId,
            goalId: goal.id,
            startDate: generationContext.startDate,
            endDate: generationContext.endDate,
            generationContext,
            payload,
          }),
          (error) =>
            Effect.gen(function* () {
              yield* options.repo.recordGenerationEvent({
                id: idGenerator(),
                userId,
                goalId: goal.id,
                weeklyPlanId: null,
                status: "failure",
                provider: options.model.provider,
                model: options.model.model,
                startDate: input.startDate,
                failureCategory: toFailureCategory(error),
                failureMessage: toFailureMessage(error),
                generationContext,
                modelOutput: payload,
              });

              return yield* Effect.fail(error);
            }),
        );

        yield* options.repo.recordGenerationEvent({
          id: idGenerator(),
          userId,
          goalId: goal.id,
          weeklyPlanId: draft.id,
          status: "success",
          provider: options.model.provider,
          model: options.model.model,
          startDate: input.startDate,
          failureCategory: null,
          failureMessage: null,
          generationContext,
          modelOutput: payload,
        });

        return draft;
      });
    },
  };
}
