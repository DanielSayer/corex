import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { isValidTimeZone } from "../activity-history/activity-calendar";
import type {
  LinkTrainingCalendarActivityInput,
  TrainingCalendarMonthInput,
} from "./contracts";
import {
  InvalidTrainingCalendarLink,
  MissingActiveDraft,
  TrainingCalendarLinkConflict,
  TrainingCalendarPersistenceFailure,
} from "./errors";
import { createLiveTrainingCalendarService } from "./live";
import type { TrainingCalendarService } from "./service";

type CreateTrainingCalendarRouterOptions = {
  service?: TrainingCalendarService;
};

const isoTimestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO timestamp");

const monthInputSchema: z.ZodType<TrainingCalendarMonthInput> = z
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

const linkActivityInputSchema: z.ZodType<LinkTrainingCalendarActivityInput> =
  z.object({
    plannedDate: z.iso.date(),
    activityId: z.string().trim().min(1),
    timezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid timezone",
    }),
  });

function mapTrainingCalendarError(error: unknown) {
  if (
    error instanceof MissingActiveDraft ||
    error instanceof InvalidTrainingCalendarLink
  ) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof TrainingCalendarLinkConflict) {
    return new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof TrainingCalendarPersistenceFailure) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: error,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Training calendar request failed",
    cause: error,
  });
}

export function createTrainingCalendarRouter(
  options: CreateTrainingCalendarRouterOptions = {},
) {
  const getService = () =>
    options.service ?? createLiveTrainingCalendarService();

  return router({
    month: authedProcedure
      .input(monthInputSchema)
      .query(({ ctx, input }) =>
        executeEffect(
          getService().month(ctx.session.user.id, input),
          mapTrainingCalendarError,
        ),
      ),
    linkActivity: authedProcedure
      .input(linkActivityInputSchema)
      .mutation(({ ctx, input }) =>
        executeEffect(
          getService().linkActivity(ctx.session.user.id, input),
          mapTrainingCalendarError,
        ),
      ),
  });
}

export const trainingCalendarRouter = createTrainingCalendarRouter();
