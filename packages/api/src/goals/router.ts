import { TRPCError } from "@trpc/server";

import { trainingGoalSchema } from "../training-settings/contracts";
import { PersistenceFailure } from "../training-settings/errors";
import { InvalidSettings } from "../training-settings/errors";
import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { createLiveGoalsApi } from "./live";
import type { GoalsApi } from "./service";

type CreateGoalsRouterOptions = {
  service?: GoalsApi;
};

function mapGoalsError(error: unknown) {
  if (error instanceof InvalidSettings) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof PersistenceFailure) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Goals request failed",
    cause: error,
  });
}

export function createGoalsRouter(options: CreateGoalsRouterOptions = {}) {
  const service = options.service ?? createLiveGoalsApi();

  return router({
    get: authedProcedure.query(({ ctx }) =>
      executeEffect(service.getForUser(ctx.session.user.id), mapGoalsError),
    ),
    update: authedProcedure
      .input(trainingGoalSchema)
      .mutation(({ ctx, input }) =>
        executeEffect(
          service.updateForUser(ctx.session.user.id, input),
          mapGoalsError,
        ),
      ),
  });
}

export const goalsRouter = createGoalsRouter();
