import { TRPCError } from "@trpc/server";
import { Effect } from "effect";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { listSyncEventsInputSchema } from "./contracts";
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
import { toSyncStatusSummary } from "./summary";

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
  const getService = () => options.service ?? createLiveIntervalsSyncApi();

  return router({
    trigger: authedProcedure.mutation(({ ctx }) =>
      executeEffect(
        getService()
          .syncNow(ctx.session.user.id)
          .pipe(Effect.map(toSyncStatusSummary)),
        mapIntervalsSyncError,
      ),
    ),
    latest: authedProcedure.query(({ ctx }) =>
      executeEffect(
        getService()
          .latest(ctx.session.user.id)
          .pipe(
            Effect.map((summary) =>
              summary ? toSyncStatusSummary(summary) : null,
            ),
          ),
        mapIntervalsSyncError,
      ),
    ),
    listEvents: authedProcedure
      .input(listSyncEventsInputSchema)
      .query(({ ctx, input }) =>
        executeEffect(
          getService().listEvents(ctx.session.user.id, input),
          mapIntervalsSyncError,
        ),
      ),
  });
}

export const intervalsSyncRouter = createIntervalsSyncRouter();
