import { TRPCError } from "@trpc/server";

import {
  EncryptionFailure,
  InvalidApiKeyFormat,
  InvalidSettings,
  PersistenceFailure,
} from "./errors";
import { createLiveTrainingSettingsService } from "./live";
import { type TrainingSettingsService } from "./service";
import { trainingSettingsInputSchema } from "./contracts";
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
  const service = options.service ?? createLiveTrainingSettingsService();

  return router({
    get: authedProcedure.query(({ ctx }) =>
      executeEffect(
        service.getForUser(ctx.session.user.id),
        mapTrainingSettingsError,
      ),
    ),
    upsert: authedProcedure
      .input(trainingSettingsInputSchema)
      .mutation(({ ctx, input }) =>
        executeEffect(
          service.upsertForUser(ctx.session.user.id, input),
          mapTrainingSettingsError,
        ),
      ),
  });
}

export const trainingSettingsRouter = createTrainingSettingsRouter();
