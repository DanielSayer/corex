import type { HeartRateZoneTimes } from "./contracts";

export type PlanningSyncSummary = {
  status: "in_progress" | "success" | "failure";
  failedDetailCount: number;
  failedMapCount: number;
  failedStreamCount: number;
  skippedInvalidCount: number;
  skippedNonRunningCount: number;
  unknownActivityTypes: string[];
};

export type PlanningPrSource = {
  distanceMeters: number;
  durationSeconds: number;
  activityId: string;
  startAt: Date;
  startSampleIndex: number;
  endSampleIndex: number;
};

export type TrailingWeekBucket = {
  weekIndex: number;
  start: Date;
  end: Date;
};

const NULL_HEART_RATE_ZONES: HeartRateZoneTimes = {
  z1Seconds: null,
  z2Seconds: null,
  z3Seconds: null,
  z4Seconds: null,
  z5Seconds: null,
};

const DISTANCE_LABELS = new Map<number, string>([
  [400, "400m"],
  [1000, "1km"],
  [1609.344, "1 mile"],
  [5000, "5k"],
  [10000, "10k"],
  [21097.5, "half marathon"],
  [42195, "marathon"],
]);

export function getNullHeartRateZoneTimes(): HeartRateZoneTimes {
  return { ...NULL_HEART_RATE_ZONES };
}

export function getDistanceLabel(distanceMeters: number) {
  return DISTANCE_LABELS.get(distanceMeters) ?? `${distanceMeters}m`;
}

export function buildTrailingWeekBuckets(now: Date, bucketCount: number) {
  const buckets: TrailingWeekBucket[] = [];

  for (let index = 0; index < bucketCount; index += 1) {
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() - index * 7);

    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - (index + 1) * 7);

    buckets.push({
      weekIndex: index + 1,
      start,
      end,
    });
  }

  return buckets;
}

export function normalizeNumericArray(data: unknown): number[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const values: number[] = [];

  for (const value of data) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    values.push(value);
  }

  return values;
}

function getZoneKey(heartRate: number, athleteMaxHeartRate: number) {
  const percentOfMax = (heartRate / athleteMaxHeartRate) * 100;

  if (percentOfMax < 60) {
    return "z1Seconds" as const;
  }

  if (percentOfMax < 70) {
    return "z2Seconds" as const;
  }

  if (percentOfMax < 80) {
    return "z3Seconds" as const;
  }

  if (percentOfMax < 90) {
    return "z4Seconds" as const;
  }

  return "z5Seconds" as const;
}

export function deriveHeartRateZoneTimes(input: {
  heartRateSamples: number[] | null;
  athleteMaxHeartRate: number | null;
  movingTimeSeconds: number | null;
}): HeartRateZoneTimes {
  if (
    !input.heartRateSamples ||
    input.heartRateSamples.length === 0 ||
    input.athleteMaxHeartRate == null ||
    input.athleteMaxHeartRate <= 0 ||
    input.movingTimeSeconds == null ||
    input.movingTimeSeconds <= 0
  ) {
    return getNullHeartRateZoneTimes();
  }

  const totals = {
    z1Seconds: 0,
    z2Seconds: 0,
    z3Seconds: 0,
    z4Seconds: 0,
    z5Seconds: 0,
  };
  const secondsPerSample =
    input.movingTimeSeconds / input.heartRateSamples.length;

  for (const sample of input.heartRateSamples) {
    totals[getZoneKey(sample, input.athleteMaxHeartRate)] += secondsPerSample;
  }

  return {
    z1Seconds: Math.round(totals.z1Seconds),
    z2Seconds: Math.round(totals.z2Seconds),
    z3Seconds: Math.round(totals.z3Seconds),
    z4Seconds: Math.round(totals.z4Seconds),
    z5Seconds: Math.round(totals.z5Seconds),
  };
}

export function sumHeartRateZoneTimes(zoneTimes: HeartRateZoneTimes[]) {
  const known = zoneTimes.filter((zoneTime) =>
    Object.values(zoneTime).some((value) => value != null),
  );

  if (known.length === 0) {
    return getNullHeartRateZoneTimes();
  }

  return {
    z1Seconds: known.reduce(
      (sum, zoneTime) => sum + (zoneTime.z1Seconds ?? 0),
      0,
    ),
    z2Seconds: known.reduce(
      (sum, zoneTime) => sum + (zoneTime.z2Seconds ?? 0),
      0,
    ),
    z3Seconds: known.reduce(
      (sum, zoneTime) => sum + (zoneTime.z3Seconds ?? 0),
      0,
    ),
    z4Seconds: known.reduce(
      (sum, zoneTime) => sum + (zoneTime.z4Seconds ?? 0),
      0,
    ),
    z5Seconds: known.reduce(
      (sum, zoneTime) => sum + (zoneTime.z5Seconds ?? 0),
      0,
    ),
  };
}

export function normalizeLatestSyncWarnings(input: {
  hasRecentSync: boolean;
  hasAnyHistory: boolean;
  latestSync: PlanningSyncSummary | null;
}) {
  if (!input.latestSync) {
    return input.hasAnyHistory && !input.hasRecentSync ? ["sync_stale"] : [];
  }

  const warnings: string[] = [];

  if (input.latestSync.status === "failure") {
    warnings.push("latest_sync_failed");
  }

  if (input.latestSync.failedDetailCount > 0) {
    warnings.push("partial_detail_failures");
  }

  if (input.latestSync.failedMapCount > 0) {
    warnings.push("partial_map_failures");
  }

  if (input.latestSync.failedStreamCount > 0) {
    warnings.push("partial_stream_failures");
  }

  if (input.latestSync.skippedInvalidCount > 0) {
    warnings.push("invalid_runs_skipped");
  }

  if (
    input.latestSync.skippedNonRunningCount > 0 ||
    input.latestSync.unknownActivityTypes.length > 0
  ) {
    warnings.push("unsupported_activity_types_skipped");
  }

  if (input.hasAnyHistory && !input.hasRecentSync) {
    warnings.push("sync_stale");
  }

  return warnings;
}

export function trimRecentPrs(prs: PlanningPrSource[], now: Date) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 3);

  return prs
    .filter((pr) => pr.startAt >= cutoff)
    .sort((left, right) => right.startAt.getTime() - left.startAt.getTime());
}

export function meetsHistoryThreshold(input: {
  runCount: number;
  oldestStartAt: Date | null;
  newestStartAt: Date | null;
}) {
  if (input.runCount >= 5) {
    return true;
  }

  if (!input.oldestStartAt || !input.newestStartAt) {
    return false;
  }

  const spanMs = input.newestStartAt.getTime() - input.oldestStartAt.getTime();

  return spanMs >= 14 * 24 * 60 * 60 * 1000;
}
