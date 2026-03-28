import { and, desc, eq, inArray } from "drizzle-orm";

import type { Database } from "@corex/db";
import {
  importedActivity,
  importedActivityMap,
} from "@corex/db/schema/intervals-sync";

import {
  intervalsActivityDetailSchema,
  intervalsActivityMapSchema,
} from "./schemas";

export async function loadRecentActivities(db: Database, userId: string) {
  const activityRows = await db.query.importedActivity.findMany({
    where: eq(importedActivity.userId, userId),
    orderBy: desc(importedActivity.startAt),
    limit: 5,
  });

  if (activityRows.length === 0) {
    return [];
  }

  const mapRows = await db.query.importedActivityMap.findMany({
    where: and(
      eq(importedActivityMap.userId, userId),
      inArray(
        importedActivityMap.upstreamActivityId,
        activityRows.map((row) => row.upstreamActivityId),
      ),
    ),
  });

  const mapByActivityId = new Map(
    mapRows.map((row) => [row.upstreamActivityId, row]),
  );

  return activityRows.map((row) => {
    const detailResult = intervalsActivityDetailSchema.safeParse(row.rawDetail);
    const detail = detailResult.success ? detailResult.data : null;
    const mapRow = mapByActivityId.get(row.upstreamActivityId);
    const mapResult = mapRow
      ? intervalsActivityMapSchema.safeParse(mapRow.rawMap)
      : null;
    const map = mapResult?.success ? mapResult.data : null;

    return {
      id: row.upstreamActivityId,
      name:
        typeof detail?.name === "string" && detail.name.trim().length > 0
          ? detail.name
          : "Untitled run",
      startDate: row.startAt.toISOString(),
      distance: detail?.distance ?? 0,
      elapsedTime:
        detail?.elapsed_time == null
          ? row.elapsedTimeSeconds
          : Math.round(detail.elapsed_time),
      averageHeartrate:
        detail?.average_heartrate == null
          ? row.averageHeartrate
          : detail.average_heartrate,
      routePreview:
        map?.latlngs && Array.isArray(map.latlngs)
          ? { latlngs: map.latlngs }
          : null,
    };
  });
}
