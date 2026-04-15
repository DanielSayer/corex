import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../index";
import { executeEffect } from "../trpc/effect";
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
    ensureLatest: authedProcedure.mutation(({ ctx }) =>
      executeEffect(
        getService().ensureLatestForUser(ctx.session.user.id),
        mapWeeklySnapshotsError,
      ),
    ),
    getByWeek: authedProcedure
      .input(byWeekInputSchema)
      .query(({ ctx, input }) =>
        executeEffect(
          getService().getByWeekForUser({
            userId: ctx.session.user.id,
            weekStart: new Date(input.weekStart),
            weekEnd: new Date(input.weekEnd),
          }),
          mapWeeklySnapshotsError,
        ),
      ),
  });
}

export const weeklySnapshotsRouter = createWeeklySnapshotsRouter();
