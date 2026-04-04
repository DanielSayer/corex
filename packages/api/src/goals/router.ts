import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
  const getService = () => options.service ?? createLiveGoalsApi();

  return router({
    get: authedProcedure.query(({ ctx }) =>
      executeEffect(
        getService().getForUser(ctx.session.user.id),
        mapGoalsError,
      ),
    ),
    create: authedProcedure
      .input(trainingGoalSchema)
      .mutation(({ ctx, input }) =>
        executeEffect(
          getService().createForUser(ctx.session.user.id, input),
          mapGoalsError,
        ),
      ),
    update: authedProcedure
      .input(
        z.object({
          id: z.string().min(1),
          goal: trainingGoalSchema,
        }),
      )
      .mutation(({ ctx, input }) =>
        executeEffect(
          getService().updateForUser(ctx.session.user.id, input.id, input.goal),
          mapGoalsError,
        ),
      ),
  });
}

export const goalsRouter = createGoalsRouter();
