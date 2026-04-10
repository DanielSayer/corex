import { and, asc, eq, gte, lt } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import { importedActivity } from "@corex/db/schema/intervals-sync";
import { weeklyPlanActivityLink } from "@corex/db/schema/weekly-planning";

import type { CalendarActivityRecord } from "../activity-history/activity-calendar";
import { TrainingCalendarPersistenceFailure } from "./errors";
import type { TrainingCalendarLinkRecord } from "./domain";

export type TrainingCalendarRepository = ReturnType<
  typeof createTrainingCalendarRepository
>;

export function createTrainingCalendarRepository(db: Database) {
  return {
    listActivitiesInRange(userId: string, input: { from: string; to: string }) {
      return Effect.tryPromise({
        try: async (): Promise<CalendarActivityRecord[]> => {
          const rows = await db.query.importedActivity.findMany({
            where: and(
              eq(importedActivity.userId, userId),
              gte(importedActivity.startAt, new Date(input.from)),
              lt(importedActivity.startAt, new Date(input.to)),
            ),
            orderBy: asc(importedActivity.startAt),
          });

          return rows.map((row) => ({
            id: row.upstreamActivityId,
            name: row.name,
            startDate: row.startAt,
            elapsedTime: row.elapsedTimeSeconds,
            distance: row.distanceMeters,
            averageHeartrate: row.averageHeartrate,
            trainingLoad: row.trainingLoad,
            totalElevationGain: row.totalElevationGainMeters,
          }));
        },
        catch: (cause) =>
          new TrainingCalendarPersistenceFailure({
            message: "Failed to load training calendar activities",
            cause,
          }),
      });
    },
    getActivity(userId: string, activityId: string) {
      return Effect.tryPromise({
        try: async (): Promise<CalendarActivityRecord | null> => {
          const row = await db.query.importedActivity.findFirst({
            where: and(
              eq(importedActivity.userId, userId),
              eq(importedActivity.upstreamActivityId, activityId),
            ),
          });

          if (!row) {
            return null;
          }

          return {
            id: row.upstreamActivityId,
            name: row.name,
            startDate: row.startAt,
            elapsedTime: row.elapsedTimeSeconds,
            distance: row.distanceMeters,
            averageHeartrate: row.averageHeartrate,
            trainingLoad: row.trainingLoad,
            totalElevationGain: row.totalElevationGainMeters,
          };
        },
        catch: (cause) =>
          new TrainingCalendarPersistenceFailure({
            message: "Failed to load training calendar activity",
            cause,
          }),
      });
    },
    listLinksForDraft(userId: string, weeklyPlanId: string) {
      return Effect.tryPromise({
        try: async (): Promise<TrainingCalendarLinkRecord[]> => {
          const rows = await db.query.weeklyPlanActivityLink.findMany({
            where: and(
              eq(weeklyPlanActivityLink.userId, userId),
              eq(weeklyPlanActivityLink.weeklyPlanId, weeklyPlanId),
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
          new TrainingCalendarPersistenceFailure({
            message: "Failed to load training calendar links",
            cause,
          }),
      });
    },
    getLinkForPlannedDate(
      userId: string,
      weeklyPlanId: string,
      plannedDate: string,
    ) {
      return Effect.tryPromise({
        try: async (): Promise<TrainingCalendarLinkRecord | null> => {
          const row = await db.query.weeklyPlanActivityLink.findFirst({
            where: and(
              eq(weeklyPlanActivityLink.userId, userId),
              eq(weeklyPlanActivityLink.weeklyPlanId, weeklyPlanId),
              eq(weeklyPlanActivityLink.plannedDate, plannedDate),
            ),
          });

          return row
            ? {
                weeklyPlanId: row.weeklyPlanId,
                plannedDate: row.plannedDate,
                activityId: row.activityId,
              }
            : null;
        },
        catch: (cause) =>
          new TrainingCalendarPersistenceFailure({
            message: "Failed to load training calendar planned-date link",
            cause,
          }),
      });
    },
    getLinkForActivity(userId: string, activityId: string) {
      return Effect.tryPromise({
        try: async (): Promise<TrainingCalendarLinkRecord | null> => {
          const row = await db.query.weeklyPlanActivityLink.findFirst({
            where: and(
              eq(weeklyPlanActivityLink.userId, userId),
              eq(weeklyPlanActivityLink.activityId, activityId),
            ),
          });

          return row
            ? {
                weeklyPlanId: row.weeklyPlanId,
                plannedDate: row.plannedDate,
                activityId: row.activityId,
              }
            : null;
        },
        catch: (cause) =>
          new TrainingCalendarPersistenceFailure({
            message: "Failed to load training calendar activity link",
            cause,
          }),
      });
    },
    createLink(input: {
      userId: string;
      weeklyPlanId: string;
      plannedDate: string;
      activityId: string;
    }) {
      return Effect.tryPromise({
        try: async (): Promise<TrainingCalendarLinkRecord> => {
          const [row] = await db
            .insert(weeklyPlanActivityLink)
            .values({
              userId: input.userId,
              weeklyPlanId: input.weeklyPlanId,
              plannedDate: input.plannedDate,
              activityId: input.activityId,
            })
            .returning();

          if (!row) {
            throw new TrainingCalendarPersistenceFailure({
              message: "Training calendar link could not be reloaded",
            });
          }

          return {
            weeklyPlanId: row.weeklyPlanId,
            plannedDate: row.plannedDate,
            activityId: row.activityId,
          };
        },
        catch: (cause) =>
          cause instanceof TrainingCalendarPersistenceFailure
            ? cause
            : new TrainingCalendarPersistenceFailure({
                message: "Failed to persist training calendar link",
                cause,
              }),
      });
    },
  };
}
