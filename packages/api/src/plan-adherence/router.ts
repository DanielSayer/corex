import { TRPCError } from "@trpc/server";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { summaryForPlanInputSchema } from "./contracts";
import {
  PlanAdherencePersistenceFailure,
  PlanAdherencePlanNotFound,
  PlanAdherenceValidationError,
} from "./errors";
import { createLivePlanAdherenceService } from "./live";
import type { PlanAdherenceService } from "./service";

type CreatePlanAdherenceRouterOptions = {
  service?: PlanAdherenceService;
};

function mapPlanAdherenceError(error: unknown) {
  if (error instanceof PlanAdherencePlanNotFound) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof PlanAdherenceValidationError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof PlanAdherencePersistenceFailure) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Plan adherence request failed",
    cause: error,
  });
}

export function createPlanAdherenceRouter(
  options: CreatePlanAdherenceRouterOptions = {},
) {
  const getService = () => options.service ?? createLivePlanAdherenceService();

  return router({
    summaryForPlan: authedProcedure
      .input(summaryForPlanInputSchema)
      .query(({ ctx, input }) =>
        executeEffect(
          getService().summaryForPlan(ctx.session.user.id, input),
          mapPlanAdherenceError,
        ),
      ),
  });
}

export const planAdherenceRouter = createPlanAdherenceRouter();
