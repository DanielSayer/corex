import { TRPCError } from "@trpc/server";

import { PersistenceFailure } from "../training-settings/errors";
import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { createLiveGoalProgressService } from "./live";
import type { GoalProgressService } from "./service";

type CreateGoalProgressRouterOptions = {
  service?: GoalProgressService;
};

function mapGoalProgressError(error: unknown) {
  if (error instanceof PersistenceFailure) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Goal progress request failed",
    cause: error,
  });
}

export function createGoalProgressRouter(
  options: CreateGoalProgressRouterOptions = {},
) {
  const service = options.service ?? createLiveGoalProgressService();

  return router({
    get: authedProcedure.query(({ ctx }) =>
      executeEffect(
        service.getForUser(ctx.session.user.id),
        mapGoalProgressError,
      ),
    ),
  });
}

export const goalProgressRouter = createGoalProgressRouter();
