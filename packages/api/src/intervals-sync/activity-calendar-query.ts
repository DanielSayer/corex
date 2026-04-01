import { and, asc, eq, gte, lt } from "drizzle-orm";

import type { Database } from "@corex/db";
import { importedActivity } from "@corex/db/schema/intervals-sync";

import {
  buildActivityCalendar,
  type ActivityCalendarQueryInput,
} from "./activity-calendar";

export async function loadActivityCalendar(
  db: Database,
  userId: string,
  input: ActivityCalendarQueryInput,
) {
  const activityRows = await db.query.importedActivity.findMany({
    where: and(
      eq(importedActivity.userId, userId),
      gte(importedActivity.startAt, new Date(input.from)),
      lt(importedActivity.startAt, new Date(input.to)),
    ),
    orderBy: asc(importedActivity.startAt),
  });

  return buildActivityCalendar(input, [
    ...activityRows.map((row) => ({
      id: row.upstreamActivityId,
      name: row.name,
      startDate: row.startAt,
      elapsedTime: row.elapsedTimeSeconds,
      distance: row.distanceMeters,
      averageHeartrate: row.averageHeartrate,
      trainingLoad: row.trainingLoad,
      totalElevationGain: row.totalElevationGainMeters,
    })),
  ]);
}
