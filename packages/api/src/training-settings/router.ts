import { Cause, Effect, Exit, Option } from "effect";
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

type CreateTrainingSettingsRouterOptions = {
  service?: TrainingSettingsService;
};

function mapTrainingSettingsError(error: unknown) {
  if (error instanceof InvalidSettings || error instanceof InvalidApiKeyFormat) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof EncryptionFailure || error instanceof PersistenceFailure) {
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

async function executeTrainingSettingsEffect<A>(
  effect: Effect.Effect<A, unknown>,
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const failure = Cause.failureOption(exit.cause);

  if (Option.isSome(failure)) {
    throw mapTrainingSettingsError(failure.value);
  }

  throw mapTrainingSettingsError(exit.cause);
}

export function createTrainingSettingsRouter(
  options: CreateTrainingSettingsRouterOptions = {},
) {
  const service = options.service ?? createLiveTrainingSettingsService();

  return router({
    get: authedProcedure.query(({ ctx }) =>
      executeTrainingSettingsEffect(service.getForUser(ctx.session.user.id)),
    ),
    upsert: authedProcedure
      .input(trainingSettingsInputSchema)
      .mutation(({ ctx, input }) =>
        executeTrainingSettingsEffect(
          service.upsertForUser(ctx.session.user.id, input),
        ),
      ),
  });
}

export const trainingSettingsRouter = createTrainingSettingsRouter();
