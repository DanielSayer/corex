import type { NormalizedActivity } from "./module-types";
import type { IntervalsActivityDetail } from "./schemas";

const RUNNING_ACTIVITY_TYPES = new Set([
  "Run",
  "TrailRun",
  "TreadmillRun",
  "VirtualRun",
]);

export function classifyRunningActivityType(
  type: string | null | undefined,
): string | null {
  if (!type) {
    return null;
  }

  return RUNNING_ACTIVITY_TYPES.has(type) ? type : null;
}

export function normalizeDetail(
  detail: IntervalsActivityDetail,
): NormalizedActivity | null {
  const normalizedActivityType = classifyRunningActivityType(detail.type);

  if (
    !normalizedActivityType ||
    !detail.start_date ||
    detail.moving_time == null ||
    detail.distance == null
  ) {
    return null;
  }

  const startAt = new Date(detail.start_date);

  if (Number.isNaN(startAt.getTime())) {
    return null;
  }

  return {
    detail,
    normalizedActivityType,
    startAt,
    movingTimeSeconds: Math.round(detail.moving_time),
    elapsedTimeSeconds:
      detail.elapsed_time == null ? null : Math.round(detail.elapsed_time),
    distanceMeters: detail.distance,
  };
}
