import { TRPCError } from "@trpc/server";
import { z } from "zod";

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
import { createLiveIntervalsSyncApi } from "./live";
import type { IntervalsSyncApi } from "./module";

type CreateIntervalsSyncRouterOptions = {
  service?: IntervalsSyncApi;
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
  const service = options.service ?? createLiveIntervalsSyncApi();

  return router({
    trigger: authedProcedure.mutation(({ ctx }) =>
      executeEffect(
        service.syncNow(ctx.session.user.id),
        mapIntervalsSyncError,
      ),
    ),
    latest: authedProcedure.query(({ ctx }) =>
      executeEffect(service.latest(ctx.session.user.id), mapIntervalsSyncError),
    ),
    recentActivities: authedProcedure.query(({ ctx }) =>
      executeEffect(
        service.recentActivities(ctx.session.user.id),
        mapIntervalsSyncError,
      ),
    ),
    activitySummary: authedProcedure
      .input(
        z.object({
          activityId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) =>
        executeEffect(
          service.activitySummary(ctx.session.user.id, input.activityId),
          mapIntervalsSyncError,
        ),
      ),
    activityAnalysis: authedProcedure
      .input(
        z.object({
          activityId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) =>
        executeEffect(
          service.activityAnalysis(ctx.session.user.id, input.activityId),
          mapIntervalsSyncError,
        ),
      ),
  });
}

export const intervalsSyncRouter = createIntervalsSyncRouter();
