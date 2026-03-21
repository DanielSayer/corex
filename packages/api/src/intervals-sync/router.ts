import { Cause, Effect, Exit, Option } from "effect";
import { TRPCError } from "@trpc/server";

import { authedProcedure, router } from "../index";
import { PersistenceFailure } from "../training-settings/errors";
import {
  InvalidIntervalsCredentials,
  IntervalsSchemaValidationFailure,
  IntervalsUpstreamFailure,
  MissingIntervalsCredentials,
  SyncAlreadyInProgress,
  SyncPersistenceFailure,
} from "./errors";
import { createLiveIntervalsSyncService } from "./live";
import type { IntervalsSyncService } from "./service";

type CreateIntervalsSyncRouterOptions = {
  service?: IntervalsSyncService;
};

function mapIntervalsSyncError(error: unknown) {
  if (error instanceof SyncAlreadyInProgress) {
    return new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof MissingIntervalsCredentials ||
    error instanceof InvalidIntervalsCredentials
  ) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof IntervalsUpstreamFailure ||
    error instanceof IntervalsSchemaValidationFailure
  ) {
    return new TRPCError({
      code: "BAD_GATEWAY",
      message: error.message,
      cause: error,
    });
  }

  if (
    error instanceof SyncPersistenceFailure ||
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
    message: "Intervals sync request failed",
    cause: error,
  });
}

async function executeIntervalsSyncEffect<A>(
  effect: Effect.Effect<A, unknown>,
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const failure = Cause.failureOption(exit.cause);

  if (Option.isSome(failure)) {
    throw mapIntervalsSyncError(failure.value);
  }

  throw mapIntervalsSyncError(exit.cause);
}

export function createIntervalsSyncRouter(
  options: CreateIntervalsSyncRouterOptions = {},
) {
  const service = options.service ?? createLiveIntervalsSyncService();

  return router({
    trigger: authedProcedure.mutation(({ ctx }) =>
      executeIntervalsSyncEffect(service.triggerForUser(ctx.session.user.id)),
    ),
    latest: authedProcedure.query(({ ctx }) =>
      executeIntervalsSyncEffect(service.latestForUser(ctx.session.user.id)),
    ),
  });
}

export const intervalsSyncRouter = createIntervalsSyncRouter();
