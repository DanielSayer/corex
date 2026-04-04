import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { PersistenceFailure } from "../training-settings/errors";
import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { isValidTimeZone } from "./timezones";
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
  const getService = () => options.service ?? createLiveGoalProgressService();
  const goalProgressInputSchema = z
    .object({
      timezone: z.string().trim().min(1).refine(isValidTimeZone, {
        message: "Invalid timezone",
      }),
    })
    .optional();

  return router({
    get: authedProcedure
      .input(goalProgressInputSchema)
      .query(({ ctx, input }) =>
        executeEffect(
          getService().getForUser(
            ctx.session.user.id,
            input?.timezone ?? "UTC",
          ),
          mapGoalProgressError,
        ),
      ),
  });
}

export const goalProgressRouter = createGoalProgressRouter();
