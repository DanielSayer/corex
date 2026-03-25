export const TARGET_EFFORT_DISTANCES_METERS = [
  400, 1000, 1609.344, 5000, 10000, 21097.5, 42195,
] as const;

export type TargetEffortDistanceMeters =
  (typeof TARGET_EFFORT_DISTANCES_METERS)[number];

export type RunBestEffortInput = {
  distanceMeters: number;
  durationSeconds: number;
  startSampleIndex: number;
  endSampleIndex: number;
};

export type RunProcessingWarning = {
  code:
    | "missing_distance_stream"
    | "invalid_distance_stream"
    | "distance_stream_cadence_mismatch";
  message: string;
  metadata: Record<string, unknown>;
};

export type PrCandidate = {
  userId: string;
  upstreamActivityId: string;
  distanceMeters: number;
  durationSeconds: number;
  startSampleIndex: number;
  endSampleIndex: number;
  startAt: Date;
};

export function normalizeMonthStart(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
  );
}

export function normalizeDistanceStreamData(data: unknown): number[] | null {
  if (!Array.isArray(data)) {
    return null;
  }

  const normalized: number[] = [];

  for (const value of data) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }

    normalized.push(value);
  }

  return normalized;
}

export function validateDistanceStreamSampleCount(
  sampleCount: number,
  movingTimeSeconds: number,
) {
  if (sampleCount <= 1 || movingTimeSeconds <= 0) {
    return false;
  }

  return true;
}

export function isMonotonicDistanceStream(values: number[]) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index]! < values[index - 1]!) {
      return false;
    }
  }

  return true;
}

function findFirstIndexAtOrAbove(
  values: number[],
  target: number,
  startIndex: number,
) {
  let low = startIndex;
  let high = values.length - 1;
  let answer = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (values[mid]! >= target) {
      answer = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return answer;
}

function interpolateCrossingTime(
  values: number[],
  targetDistance: number,
  crossingIndex: number,
) {
  if (crossingIndex <= 0) {
    return crossingIndex;
  }

  const previousIndex = crossingIndex - 1;
  const previousDistance = values[previousIndex]!;
  const currentDistance = values[crossingIndex]!;

  if (targetDistance <= previousDistance) {
    return previousIndex;
  }

  if (currentDistance === previousDistance) {
    return crossingIndex;
  }

  const fraction =
    (targetDistance - previousDistance) / (currentDistance - previousDistance);

  return previousIndex + fraction;
}

export function computeBestEfforts(distanceSamples: number[]) {
  if (
    distanceSamples.length <= 1 ||
    !isMonotonicDistanceStream(distanceSamples)
  ) {
    return [];
  }

  const maxDistance = distanceSamples[distanceSamples.length - 1]!;
  const bestEfforts: RunBestEffortInput[] = [];

  for (const targetDistance of TARGET_EFFORT_DISTANCES_METERS) {
    if (maxDistance < targetDistance) {
      continue;
    }

    let bestEffort: RunBestEffortInput | null = null;

    for (
      let startIndex = 0;
      startIndex < distanceSamples.length;
      startIndex += 1
    ) {
      const endTargetDistance = distanceSamples[startIndex]! + targetDistance;

      if (endTargetDistance > maxDistance) {
        break;
      }

      const crossingIndex = findFirstIndexAtOrAbove(
        distanceSamples,
        endTargetDistance,
        startIndex + 1,
      );

      if (crossingIndex === -1) {
        break;
      }

      const endTime = interpolateCrossingTime(
        distanceSamples,
        endTargetDistance,
        crossingIndex,
      );
      const durationSeconds = endTime - startIndex;

      if (durationSeconds <= 0) {
        continue;
      }

      const candidate: RunBestEffortInput = {
        distanceMeters: targetDistance,
        durationSeconds,
        startSampleIndex: startIndex,
        endSampleIndex: crossingIndex,
      };
      const durationDelta = bestEffort
        ? candidate.durationSeconds - bestEffort.durationSeconds
        : null;

      if (
        !bestEffort ||
        (durationDelta !== null && durationDelta < -1e-9) ||
        (durationDelta !== null &&
          Math.abs(durationDelta) <= 1e-9 &&
          candidate.startSampleIndex < bestEffort.startSampleIndex)
      ) {
        bestEffort = candidate;
      }
    }

    if (bestEffort) {
      bestEfforts.push(bestEffort);
    }
  }

  return bestEfforts;
}

export function selectAllTimePr(candidates: PrCandidate[]) {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    if (left.durationSeconds !== right.durationSeconds) {
      return left.durationSeconds - right.durationSeconds;
    }

    if (left.startAt.getTime() !== right.startAt.getTime()) {
      return left.startAt.getTime() - right.startAt.getTime();
    }

    return left.upstreamActivityId.localeCompare(right.upstreamActivityId);
  })[0]!;
}

export function selectMonthlyPrs(candidates: PrCandidate[]) {
  const winners = new Map<string, PrCandidate>();

  for (const candidate of candidates) {
    const monthStart = normalizeMonthStart(candidate.startAt).toISOString();
    const existing = winners.get(monthStart);

    if (!existing) {
      winners.set(monthStart, candidate);
      continue;
    }

    const selected = selectAllTimePr([existing, candidate]);
    winners.set(monthStart, selected!);
  }

  return winners;
}
