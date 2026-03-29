import { and, eq } from "drizzle-orm";

import type { Database } from "@corex/db";
import {
  importedActivity,
  importedActivityHeartRateZone,
  importedActivityInterval,
} from "@corex/db/schema/intervals-sync";

import { normalizeActivityDetailForStorage } from "./detail-normalization";
import { intervalsActivityDetailSchema } from "./schemas";

export type BackfillNormalizedActivityDetailsResult = {
  scannedCount: number;
  updatedCount: number;
  skippedCount: number;
};

export async function backfillNormalizedActivityDetails(
  db: Database,
  options: {
    userId?: string;
  } = {},
): Promise<BackfillNormalizedActivityDetailsResult> {
  const activityRows = await db.query.importedActivity.findMany({
    where: options.userId
      ? eq(importedActivity.userId, options.userId)
      : undefined,
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const row of activityRows) {
    const parsedDetail = intervalsActivityDetailSchema.safeParse(row.rawDetail);

    if (!parsedDetail.success) {
      skippedCount += 1;
      continue;
    }

    const normalized = normalizeActivityDetailForStorage(parsedDetail.data);

    await db.transaction(async (tx) => {
      await tx
        .update(importedActivity)
        .set({
          name: normalized.scalars.name,
          startDateLocal: normalized.scalars.startDateLocal,
          deviceName: normalized.scalars.deviceName,
          totalElevationLossMeters: normalized.scalars.totalElevationLossMeters,
          maxSpeedMetersPerSecond: normalized.scalars.maxSpeedMetersPerSecond,
          maxHeartrate: normalized.scalars.maxHeartrate,
          averageCadence: normalized.scalars.averageCadence,
          calories: normalized.scalars.calories,
          trainingLoad: normalized.scalars.trainingLoad,
          hrLoad: normalized.scalars.hrLoad,
          intensity: normalized.scalars.intensity,
          athleteMaxHr: normalized.scalars.athleteMaxHr,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(importedActivity.userId, row.userId),
            eq(importedActivity.upstreamActivityId, row.upstreamActivityId),
          ),
        );

      await tx
        .delete(importedActivityHeartRateZone)
        .where(
          and(
            eq(importedActivityHeartRateZone.userId, row.userId),
            eq(
              importedActivityHeartRateZone.upstreamActivityId,
              row.upstreamActivityId,
            ),
          ),
        );

      if (normalized.heartRateZones.length > 0) {
        await tx.insert(importedActivityHeartRateZone).values(
          normalized.heartRateZones.map((zone) => ({
            userId: row.userId,
            upstreamActivityId: row.upstreamActivityId,
            zoneIndex: zone.zoneIndex,
            lowerBpm: zone.lowerBpm,
            durationSeconds: zone.durationSeconds,
          })),
        );
      }

      await tx
        .delete(importedActivityInterval)
        .where(
          and(
            eq(importedActivityInterval.userId, row.userId),
            eq(
              importedActivityInterval.upstreamActivityId,
              row.upstreamActivityId,
            ),
          ),
        );

      if (normalized.intervals.length > 0) {
        await tx.insert(importedActivityInterval).values(
          normalized.intervals.map((interval) => ({
            userId: row.userId,
            upstreamActivityId: row.upstreamActivityId,
            intervalIndex: interval.intervalIndex,
            intervalType: interval.intervalType,
            zone: interval.zone,
            intensity: interval.intensity,
            distanceMeters: interval.distanceMeters,
            movingTimeSeconds: interval.movingTimeSeconds,
            elapsedTimeSeconds: interval.elapsedTimeSeconds,
            startTimeSeconds: interval.startTimeSeconds,
            endTimeSeconds: interval.endTimeSeconds,
            averageSpeedMetersPerSecond: interval.averageSpeedMetersPerSecond,
            maxSpeedMetersPerSecond: interval.maxSpeedMetersPerSecond,
            averageHeartrate: interval.averageHeartrate,
            maxHeartrate: interval.maxHeartrate,
            averageCadence: interval.averageCadence,
            averageStride: interval.averageStride,
            totalElevationGainMeters: interval.totalElevationGainMeters,
          })),
        );
      }
    });

    updatedCount += 1;
  }

  return {
    scannedCount: activityRows.length,
    updatedCount,
    skippedCount,
  };
}
