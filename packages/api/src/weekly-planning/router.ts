import { TRPCError } from "@trpc/server";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { generateWeeklyDraftInputSchema } from "./contracts";
import {
  DraftConflict,
  GenerationTimeout,
  InvalidStructuredOutput,
  MissingGoal,
  MissingTrainingSettings,
  NoLocalHistory,
  ProviderFailure,
  WeeklyPlanningPersistenceFailure,
  WeeklyPlanningValidationError,
} from "./errors";
import { createLiveWeeklyPlanningService } from "./live";
import type { WeeklyPlanningService } from "./service";

type CreateWeeklyPlanningRouterOptions = {
  service?: WeeklyPlanningService;
};

function mapWeeklyPlanningError(error: unknown) {
  if (error instanceof DraftConflict) {
    return new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof MissingGoal ||
    error instanceof MissingTrainingSettings ||
    error instanceof NoLocalHistory ||
    error instanceof WeeklyPlanningValidationError ||
    error instanceof InvalidStructuredOutput
  ) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof ProviderFailure ||
    error instanceof GenerationTimeout ||
    error instanceof WeeklyPlanningPersistenceFailure
  ) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Weekly planning request failed",
    cause: error,
  });
}

export function createWeeklyPlanningRouter(
  options: CreateWeeklyPlanningRouterOptions = {},
) {
  const getService = () => options.service ?? createLiveWeeklyPlanningService();

  return router({
    getState: authedProcedure.query(({ ctx }) =>
      executeEffect(
        getService().getState(ctx.session.user.id),
        mapWeeklyPlanningError,
      ),
    ),
    generateDraft: authedProcedure
      .input(generateWeeklyDraftInputSchema)
      .mutation(({ ctx, input }) =>
        executeEffect(
          getService().generateDraft(ctx.session.user.id, input),
          mapWeeklyPlanningError,
        ),
      ),
  });
}

export const weeklyPlanningRouter = createWeeklyPlanningRouter();
