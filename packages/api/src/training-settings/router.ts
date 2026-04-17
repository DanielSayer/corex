import { TRPCError } from "@trpc/server";

import {
  EncryptionFailure,
  InvalidApiKeyFormat,
  InvalidSettings,
  PersistenceFailure,
} from "./errors";
import { createLiveTrainingSettingsService } from "./live";
import { type TrainingSettingsService } from "./service";
import {
  trainingGoalSchema,
  trainingSettingsInputSchema,
  updateAutomaticWeeklyPlanRenewalInputSchema,
  updateTimezoneInputSchema,
} from "./contracts";
import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";

type CreateTrainingSettingsRouterOptions = {
  service?: TrainingSettingsService;
};

function mapTrainingSettingsError(error: unknown) {
  if (
    error instanceof InvalidSettings ||
    error instanceof InvalidApiKeyFormat
  ) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof EncryptionFailure ||
    error instanceof PersistenceFailure
  ) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Training settings request failed",
    cause: error,
  });
}

export function createTrainingSettingsRouter(
  options: CreateTrainingSettingsRouterOptions = {},
) {
  const getService = () =>
    options.service ?? createLiveTrainingSettingsService();
  const upsertInputSchema = trainingSettingsInputSchema.extend({
    goal: trainingGoalSchema.optional(),
  });

  return router({
    get: authedProcedure.query(({ ctx }) =>
      executeEffect(
        getService().getForUser(ctx.session.user.id),
        mapTrainingSettingsError,
      ),
    ),
    upsert: authedProcedure
      .input(upsertInputSchema)
      .mutation(({ ctx, input }) =>
        executeEffect(
          getService().upsertForUser(ctx.session.user.id, input),
          mapTrainingSettingsError,
        ),
      ),
    updateTimezone: authedProcedure
      .input(updateTimezoneInputSchema)
      .mutation(({ ctx, input }) =>
        executeEffect(
          getService().updateTimezoneForUser(ctx.session.user.id, input),
          mapTrainingSettingsError,
        ),
      ),
    updateAutomaticWeeklyPlanRenewal: authedProcedure
      .input(updateAutomaticWeeklyPlanRenewalInputSchema)
      .mutation(({ ctx, input }) =>
        executeEffect(
          getService().updateAutomaticWeeklyPlanRenewalForUser(
            ctx.session.user.id,
            input,
          ),
          mapTrainingSettingsError,
        ),
      ),
  });
}

export const trainingSettingsRouter = createTrainingSettingsRouter();
