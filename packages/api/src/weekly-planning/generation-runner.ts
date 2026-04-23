import { Effect } from "effect";

import type {
  DraftGenerationContext,
  PlanQualityReport,
  WeeklyPlanDraft,
  WeeklyPlanPayload,
} from "./contracts";
import { validateGeneratedPayload } from "./domain";
import {
  DraftNotFound,
  PlanQualityGuardrailFailure,
  toFailureCategory,
} from "./errors";
import type { PlannerModelPort } from "./model";
import { reviewPlanQuality } from "./quality-review";
import type { WeeklyPlanningRepository } from "./repository";

type Clock = {
  now: () => Date;
};

type GenerationRunnerOptions = {
  repo: Pick<
    WeeklyPlanningRepository,
    "createDraft" | "replaceDraftGeneration" | "recordGenerationEvent"
  >;
  model: PlannerModelPort;
  clock: Clock;
  idGenerator: () => string;
};

type DraftGenerationLifecycleInput = {
  userId: string;
  goalId: string | null;
  generationContext: DraftGenerationContext;
  failureWeeklyPlanId: string | null;
  rawOutputEffect: Effect.Effect<WeeklyPlanPayload, unknown, never>;
  persistDraft: (input: {
    payload: WeeklyPlanPayload;
    qualityReport: PlanQualityReport;
  }) => Effect.Effect<WeeklyPlanDraft, unknown>;
};

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

export function createWeeklyPlanningGenerationRunner(
  options: GenerationRunnerOptions,
) {
  const recordGenerationFailure = (input: {
    userId: string;
    goalId: string | null;
    weeklyPlanId: string | null;
    generationContext: DraftGenerationContext;
    error: unknown;
    modelOutput: WeeklyPlanPayload | null;
    qualityReport?: PlanQualityReport | null;
  }) =>
    options.repo.recordGenerationEvent({
      id: options.idGenerator(),
      userId: input.userId,
      goalId: input.goalId,
      weeklyPlanId: input.weeklyPlanId,
      status: "failure",
      provider: options.model.provider,
      model: options.model.model,
      startDate: input.generationContext.startDate,
      failureCategory: toFailureCategory(input.error),
      failureMessage: toFailureMessage(input.error),
      generationContext: input.generationContext,
      modelOutput: input.modelOutput,
      qualityReport: input.qualityReport ?? null,
    });

  const recordGenerationSuccess = (input: {
    userId: string;
    goalId: string | null;
    weeklyPlanId: string;
    generationContext: DraftGenerationContext;
    payload: WeeklyPlanPayload;
    qualityReport: PlanQualityReport;
  }) =>
    options.repo.recordGenerationEvent({
      id: options.idGenerator(),
      userId: input.userId,
      goalId: input.goalId,
      weeklyPlanId: input.weeklyPlanId,
      status: "success",
      provider: options.model.provider,
      model: options.model.model,
      startDate: input.generationContext.startDate,
      failureCategory: null,
      failureMessage: null,
      generationContext: input.generationContext,
      modelOutput: input.payload,
      qualityReport: input.qualityReport,
    });

  function validatePayload(
    payload: WeeklyPlanPayload,
    generationContext: DraftGenerationContext,
  ) {
    return validateGeneratedPayload({
      payload,
      availability: generationContext.availability,
      longRunDay: generationContext.longRunDay,
      startDate: generationContext.startDate,
    });
  }

  function runDraftGenerationLifecycle(
    input: DraftGenerationLifecycleInput,
  ): Effect.Effect<WeeklyPlanDraft, unknown> {
    return Effect.gen(function* () {
      const output = yield* Effect.catchAll(input.rawOutputEffect, (error) =>
        Effect.gen(function* () {
          yield* recordGenerationFailure({
            userId: input.userId,
            goalId: input.goalId,
            weeklyPlanId: input.failureWeeklyPlanId,
            generationContext: input.generationContext,
            error,
            modelOutput: null,
          });

          return yield* Effect.fail(error);
        }),
      );

      const payload = yield* Effect.catchAll(
        Effect.try({
          try: () => validatePayload(output, input.generationContext),
          catch: (error) => error,
        }),
        (error) =>
          Effect.gen(function* () {
            yield* recordGenerationFailure({
              userId: input.userId,
              goalId: input.goalId,
              weeklyPlanId: input.failureWeeklyPlanId,
              generationContext: input.generationContext,
              error,
              modelOutput: output,
            });

            return yield* Effect.fail(error);
          }),
      );

      const qualityReport = reviewPlanQuality({
        payload,
        generationContext: input.generationContext,
        mode: "enforced",
        generatedAt: createGeneratedAt(options.clock),
      });

      if (qualityReport.status === "blocked") {
        const error = createQualityGuardrailFailure(qualityReport);

        yield* recordGenerationFailure({
          userId: input.userId,
          goalId: input.goalId,
          weeklyPlanId: input.failureWeeklyPlanId,
          generationContext: input.generationContext,
          error,
          modelOutput: payload,
          qualityReport,
        });

        return yield* Effect.fail(error);
      }

      const draft = yield* Effect.catchAll(
        input.persistDraft({
          payload,
          qualityReport,
        }),
        (error) =>
          Effect.gen(function* () {
            yield* recordGenerationFailure({
              userId: input.userId,
              goalId: input.goalId,
              weeklyPlanId: input.failureWeeklyPlanId,
              generationContext: input.generationContext,
              error,
              modelOutput: payload,
              qualityReport,
            });

            return yield* Effect.fail(error);
          }),
      );

      yield* recordGenerationSuccess({
        userId: input.userId,
        goalId: input.goalId,
        weeklyPlanId: draft.id,
        generationContext: input.generationContext,
        payload,
        qualityReport,
      });

      return draft;
    });
  }

  return {
    createAdvisoryQualityReport(input: {
      payload: WeeklyPlanPayload;
      generationContext: DraftGenerationContext;
    }) {
      return reviewPlanQuality({
        payload: input.payload,
        generationContext: input.generationContext,
        mode: "advisory",
        generatedAt: createGeneratedAt(options.clock),
      });
    },
    persistGeneratedDraft(input: {
      userId: string;
      goalId: string | null;
      parentWeeklyPlanId: string | null;
      generationContext: DraftGenerationContext;
      rawOutputEffect: Effect.Effect<WeeklyPlanPayload, unknown, never>;
    }) {
      return runDraftGenerationLifecycle({
        userId: input.userId,
        goalId: input.goalId,
        generationContext: input.generationContext,
        failureWeeklyPlanId: null,
        rawOutputEffect: input.rawOutputEffect,
        persistDraft: ({ payload, qualityReport }) =>
          options.repo.createDraft({
            id: options.idGenerator(),
            userId: input.userId,
            goalId: input.goalId,
            parentWeeklyPlanId: input.parentWeeklyPlanId,
            startDate: input.generationContext.startDate,
            endDate: input.generationContext.endDate,
            generationContext: input.generationContext,
            payload,
            qualityReport,
          }),
      });
    },
    replaceDraftWithGeneratedPayload(input: {
      userId: string;
      draftId: string;
      goalId: string | null;
      generationContext: DraftGenerationContext;
      rawOutputEffect: Effect.Effect<WeeklyPlanPayload, unknown, never>;
    }) {
      return runDraftGenerationLifecycle({
        userId: input.userId,
        goalId: input.goalId,
        generationContext: input.generationContext,
        failureWeeklyPlanId: input.draftId,
        rawOutputEffect: input.rawOutputEffect,
        persistDraft: ({ payload, qualityReport }) =>
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
      });
    },
  };
}
