import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
import { isValidTimeZone } from "../goal-progress/timezones";
import { createLiveWeeklySnapshotService } from "./live";
import type { WeeklySnapshotService } from "./service";

type CreateWeeklySnapshotsRouterOptions = {
  service?: WeeklySnapshotService;
};

function mapWeeklySnapshotsError(error: unknown) {
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Weekly snapshot request failed",
    cause: error,
  });
}

export function createWeeklySnapshotsRouter(
  options: CreateWeeklySnapshotsRouterOptions = {},
) {
  const getService = () => options.service ?? createLiveWeeklySnapshotService();
  const byWeekInputSchema = z.object({
    timezone: z.string().trim().min(1).refine(isValidTimeZone, {
      message: "Invalid timezone",
    }),
    weekStart: z.iso.datetime(),
    weekEnd: z.iso.datetime(),
  });

  return router({
    getLatest: authedProcedure.query(({ ctx }) =>
      executeEffect(
        getService().getLatestForUser(ctx.session.user.id),
        mapWeeklySnapshotsError,
      ),
    ),
    getByWeek: authedProcedure
      .input(byWeekInputSchema)
      .query(({ ctx, input }) =>
        executeEffect(
          getService().getByWeekForUser({
            userId: ctx.session.user.id,
            timezone: input.timezone,
            weekStart: new Date(input.weekStart),
            weekEnd: new Date(input.weekEnd),
          }),
          mapWeeklySnapshotsError,
        ),
      ),
  });
}

export const weeklySnapshotsRouter = createWeeklySnapshotsRouter();
