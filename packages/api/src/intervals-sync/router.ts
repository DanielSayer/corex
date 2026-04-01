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
import { isValidTimeZone } from "./activity-calendar";

type CreateIntervalsSyncRouterOptions = {
  service?: IntervalsSyncApi;
};

const isoTimestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO timestamp");

const calendarInputSchema = z
  .object({
    from: isoTimestampSchema,
    to: isoTimestampSchema,
    timezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid timezone",
    }),
  })
  .refine(({ from, to }) => new Date(from).getTime() < new Date(to).getTime(), {
    message: "`from` must be before `to`",
    path: ["to"],
  });

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
    calendar: authedProcedure
      .input(calendarInputSchema)
      .query(({ ctx, input }) =>
        executeEffect(
          service.calendar(ctx.session.user.id, input),
          mapIntervalsSyncError,
        ),
      ),
  });
}

export const intervalsSyncRouter = createIntervalsSyncRouter();
