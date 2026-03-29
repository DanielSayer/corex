import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";

import type { Database } from "@corex/db";
import {
  importedActivity,
  importedActivityHeartRateZone,
  importedActivityInterval,
  importedActivityMap,
  importedActivityStream,
} from "@corex/db/schema/intervals-sync";

import { loadActivityDetails } from "./activity-details-query";
import { normalizeActivityDetailForStorage } from "./detail-normalization";
import { SyncPersistenceFailure } from "./errors";
import { loadRecentActivities } from "./recent-activities-query";
import type { ImportedActivityPort } from "./repository-types";

export function createImportedActivityPort(db: Database): ImportedActivityPort {
  return {
    upsert(record) {
      return Effect.tryPromise({
        try: async () => {
          const existing = await db.query.importedActivity.findFirst({
            where: and(
              eq(importedActivity.userId, record.userId),
              eq(importedActivity.upstreamActivityId, record.detail.id),
            ),
          });
          const normalizedDetail = normalizeActivityDetailForStorage(
            record.detail,
          );

          const values = {
            userId: record.userId,
            upstreamActivityId: record.detail.id,
            athleteId: record.athleteId,
            upstreamActivityType:
              record.detail.type ?? record.normalizedActivityType,
            normalizedActivityType: record.normalizedActivityType,
            name: normalizedDetail.scalars.name,
            startAt: record.startAt,
            startDateLocal: normalizedDetail.scalars.startDateLocal,
            deviceName: normalizedDetail.scalars.deviceName,
            movingTimeSeconds: record.movingTimeSeconds,
            elapsedTimeSeconds: record.elapsedTimeSeconds,
            distanceMeters: record.distanceMeters,
            totalElevationGainMeters:
              record.detail.total_elevation_gain ?? null,
            totalElevationLossMeters:
              normalizedDetail.scalars.totalElevationLossMeters,
            averageSpeedMetersPerSecond: record.detail.average_speed ?? null,
            maxSpeedMetersPerSecond:
              normalizedDetail.scalars.maxSpeedMetersPerSecond,
            averageHeartrate: record.detail.average_heartrate ?? null,
            maxHeartrate: normalizedDetail.scalars.maxHeartrate,
            averageCadence: normalizedDetail.scalars.averageCadence,
            calories: normalizedDetail.scalars.calories,
            trainingLoad: normalizedDetail.scalars.trainingLoad,
            hrLoad: normalizedDetail.scalars.hrLoad,
            intensity: normalizedDetail.scalars.intensity,
            athleteMaxHr: normalizedDetail.scalars.athleteMaxHr,
            rawDetail: record.detail,
            updatedAt: new Date(),
          };

          return db.transaction(async (tx) => {
            if (existing) {
              await tx
                .update(importedActivity)
                .set(values)
                .where(
                  and(
                    eq(importedActivity.userId, record.userId),
                    eq(importedActivity.upstreamActivityId, record.detail.id),
                  ),
                );
            } else {
              await tx.insert(importedActivity).values(values);
            }

            await tx
              .delete(importedActivityHeartRateZone)
              .where(
                and(
                  eq(importedActivityHeartRateZone.userId, record.userId),
                  eq(
                    importedActivityHeartRateZone.upstreamActivityId,
                    record.detail.id,
                  ),
                ),
              );

            if (normalizedDetail.heartRateZones.length > 0) {
              await tx.insert(importedActivityHeartRateZone).values(
                normalizedDetail.heartRateZones.map((zone) => ({
                  userId: record.userId,
                  upstreamActivityId: record.detail.id,
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
                  eq(importedActivityInterval.userId, record.userId),
                  eq(
                    importedActivityInterval.upstreamActivityId,
                    record.detail.id,
                  ),
                ),
              );

            if (normalizedDetail.intervals.length > 0) {
              await tx.insert(importedActivityInterval).values(
                normalizedDetail.intervals.map((interval) => ({
                  userId: record.userId,
                  upstreamActivityId: record.detail.id,
                  intervalIndex: interval.intervalIndex,
                  intervalType: interval.intervalType,
                  zone: interval.zone,
                  intensity: interval.intensity,
                  distanceMeters: interval.distanceMeters,
                  movingTimeSeconds: interval.movingTimeSeconds,
                  elapsedTimeSeconds: interval.elapsedTimeSeconds,
                  startTimeSeconds: interval.startTimeSeconds,
                  endTimeSeconds: interval.endTimeSeconds,
                  averageSpeedMetersPerSecond:
                    interval.averageSpeedMetersPerSecond,
                  maxSpeedMetersPerSecond: interval.maxSpeedMetersPerSecond,
                  averageHeartrate: interval.averageHeartrate,
                  maxHeartrate: interval.maxHeartrate,
                  averageCadence: interval.averageCadence,
                  averageStride: interval.averageStride,
                  totalElevationGainMeters: interval.totalElevationGainMeters,
                })),
              );
            }

            if (record.map !== undefined && record.map !== null) {
              const mapValues = {
                userId: record.userId,
                upstreamActivityId: record.detail.id,
                hasRoute: record.map.route != null,
                hasWeather: record.map.weather != null,
                rawMap: record.map,
                updatedAt: new Date(),
              };
              const existingMap = await tx.query.importedActivityMap.findFirst({
                where: and(
                  eq(importedActivityMap.userId, record.userId),
                  eq(importedActivityMap.upstreamActivityId, record.detail.id),
                ),
              });

              if (existingMap) {
                await tx
                  .update(importedActivityMap)
                  .set(mapValues)
                  .where(
                    and(
                      eq(importedActivityMap.userId, record.userId),
                      eq(
                        importedActivityMap.upstreamActivityId,
                        record.detail.id,
                      ),
                    ),
                  );
              } else {
                await tx.insert(importedActivityMap).values(mapValues);
              }
            } else if (record.map === null) {
              await tx
                .delete(importedActivityMap)
                .where(
                  and(
                    eq(importedActivityMap.userId, record.userId),
                    eq(
                      importedActivityMap.upstreamActivityId,
                      record.detail.id,
                    ),
                  ),
                );
            }

            if (record.streams && record.streams.length > 0) {
              await tx.delete(importedActivityStream).where(
                and(
                  eq(importedActivityStream.userId, record.userId),
                  eq(
                    importedActivityStream.upstreamActivityId,
                    record.detail.id,
                  ),
                  inArray(
                    importedActivityStream.streamType,
                    record.streams.map((stream) => stream.type),
                  ),
                ),
              );

              await tx.insert(importedActivityStream).values(
                record.streams.map((stream) => ({
                  userId: record.userId,
                  upstreamActivityId: record.detail.id,
                  streamType: stream.type,
                  allNull: stream.allNull ?? null,
                  custom: stream.custom ?? null,
                  rawStream: stream,
                })),
              );
            }

            return existing ? ("updated" as const) : ("inserted" as const);
          });
        },
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to upsert imported activity",
            cause,
          }),
      });
    },
    recentActivities(userId) {
      return Effect.tryPromise({
        try: () => loadRecentActivities(db, userId),
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to load recent activities",
            cause,
          }),
      });
    },
    activityDetails(userId, activityId) {
      return Effect.tryPromise({
        try: () => loadActivityDetails(db, userId, activityId),
        catch: (cause) =>
          new SyncPersistenceFailure({
            message: "Failed to load activity details",
            cause,
          }),
      });
    },
  };
}
