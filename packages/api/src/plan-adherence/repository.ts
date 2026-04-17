import { and, asc, eq, gte, lt } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { importedActivity } from "@corex/db/schema/intervals-sync";
import { weeklyPlanActivityLink } from "@corex/db/schema/weekly-planning";

import { PlanAdherencePersistenceFailure } from "./errors";
import type {
  PlanAdherenceActivityRecord,
  PlanAdherenceLinkRecord,
} from "./domain";

export type PlanAdherenceRepository = ReturnType<
  typeof createPlanAdherenceRepository
>;

export function createPlanAdherenceRepository(db: Database) {
  return {
    listActivitiesInRange(
      userId: string,
      input: { from: Date; to: Date },
    ): Effect.Effect<
      PlanAdherenceActivityRecord[],
      PlanAdherencePersistenceFailure
    > {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db.query.importedActivity.findMany({
            where: and(
              eq(importedActivity.userId, userId),
              gte(importedActivity.startAt, input.from),
              lt(importedActivity.startAt, input.to),
            ),
            orderBy: asc(importedActivity.startAt),
          });

          return rows.map((row) => ({
            id: row.upstreamActivityId,
            name: row.name,
            startDate: row.startAt,
            elapsedTime: row.elapsedTimeSeconds,
            distance: row.distanceMeters,
          }));
        },
        catch: (cause) =>
          new PlanAdherencePersistenceFailure(
            `Failed to load plan adherence activities: ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
          ),
      });
    },
    listLinksForPlan(
      userId: string,
      planId: string,
    ): Effect.Effect<
      PlanAdherenceLinkRecord[],
      PlanAdherencePersistenceFailure
    > {
      return Effect.tryPromise({
        try: async () => {
          const rows = await db.query.weeklyPlanActivityLink.findMany({
            where: and(
              eq(weeklyPlanActivityLink.userId, userId),
              eq(weeklyPlanActivityLink.weeklyPlanId, planId),
            ),
            orderBy: asc(weeklyPlanActivityLink.plannedDate),
          });

          return rows.map((row) => ({
            weeklyPlanId: row.weeklyPlanId,
            plannedDate: row.plannedDate,
            activityId: row.activityId,
          }));
        },
        catch: (cause) =>
          new PlanAdherencePersistenceFailure(
            `Failed to load plan adherence links: ${
              cause instanceof Error ? cause.message : String(cause)
            }`,
          ),
      });
    },
  };
}
