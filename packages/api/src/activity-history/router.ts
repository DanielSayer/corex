import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import {
  isValidTimeZone,
  type ActivityCalendarQueryInput,
} from "./activity-calendar";
import { ActivityHistoryPersistenceFailure } from "./errors";
import { createLiveActivityHistoryApi } from "./live";
import type { ActivityHistoryApi } from "./service";

type CreateActivityHistoryRouterOptions = {
  service?: ActivityHistoryApi;
};

const isoTimestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO timestamp");

const calendarInputSchema: z.ZodType<ActivityCalendarQueryInput> = z
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

function mapActivityHistoryError(error: unknown) {
  if (error instanceof ActivityHistoryPersistenceFailure) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Activity history request failed",
    cause: error,
  });
}

export function createActivityHistoryRouter(
  options: CreateActivityHistoryRouterOptions = {},
) {
  const getService = () => options.service ?? createLiveActivityHistoryApi();

  return router({
    recentActivities: authedProcedure.query(({ ctx }) =>
      executeEffect(
        getService().recentActivities(ctx.session.user.id),
        mapActivityHistoryError,
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
          getService().activitySummary(ctx.session.user.id, input.activityId),
          mapActivityHistoryError,
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
          getService().activityAnalysis(ctx.session.user.id, input.activityId),
          mapActivityHistoryError,
        ),
      ),
    calendar: authedProcedure
      .input(calendarInputSchema)
      .query(({ ctx, input }) =>
        executeEffect(
          getService().calendar(ctx.session.user.id, input),
          mapActivityHistoryError,
        ),
      ),
  });
}

export const activityHistoryRouter = createActivityHistoryRouter();
