import { TRPCError } from "@trpc/server";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
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

  if (error instanceof SyncPersistenceFailure) {
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

export function createIntervalsSyncRouter(
  options: CreateIntervalsSyncRouterOptions = {},
) {
  const service = options.service ?? createLiveIntervalsSyncService();

  return router({
    trigger: authedProcedure.mutation(({ ctx }) =>
      executeEffect(
        service.triggerForUser(ctx.session.user.id),
        mapIntervalsSyncError,
      ),
    ),
    latest: authedProcedure.query(({ ctx }) =>
      executeEffect(
        service.latestForUser(ctx.session.user.id),
        mapIntervalsSyncError,
      ),
    ),
    recentActivities: authedProcedure.query(({ ctx }) =>
      executeEffect(
        service.recentActivitiesForUser(ctx.session.user.id),
        mapIntervalsSyncError,
      ),
    ),
  });
}

export const intervalsSyncRouter = createIntervalsSyncRouter();
