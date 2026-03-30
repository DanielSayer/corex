import type {
  ActivityMetricPoint,
  ActivityMetricKey,
} from "./activity-details";

function getDurationSeconds(durationSeconds: number | null) {
  if (
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return null;
  }

  return durationSeconds;
}

function inferSecondsPerPoint({
  durationSeconds,
  pointCount,
}: {
  durationSeconds: number | null;
  pointCount: number;
}) {
  if (!durationSeconds || pointCount <= 0) {
    return 1;
  }

  return durationSeconds / pointCount;
}

function mapStreamIndexToSecond({
  durationSeconds,
  index,
  pointCount,
}: {
  durationSeconds: number | null;
  index: number;
  pointCount: number;
}) {
  return (
    index *
    inferSecondsPerPoint({
      durationSeconds,
      pointCount,
    })
  );
}

function normalizeMetricValue(metric: ActivityMetricKey, value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (metric === "velocity_smooth" && value <= 0) {
    return null;
  }

  return value;
}

function downsampleActivityMetricPoints(
  points: ActivityMetricPoint[],
  maxPoints: number,
) {
  if (points.length <= maxPoints) {
    return points;
  }

  if (maxPoints <= 2) {
    return [points[0]!, points[points.length - 1]!];
  }

  const selectedIndices = new Set<number>([0, points.length - 1]);
  const internalPointCount = points.length - 2;
  const internalBudget = maxPoints - 2;
  const extremeBucketCount = Math.min(
    Math.max(0, Math.floor(internalBudget / 2)),
    internalPointCount,
  );

  if (extremeBucketCount > 0) {
    const bucketSize = internalPointCount / extremeBucketCount;

    for (
      let bucketIndex = 0;
      bucketIndex < extremeBucketCount;
      bucketIndex += 1
    ) {
      const start = 1 + Math.floor(bucketIndex * bucketSize);
      const end =
        bucketIndex === extremeBucketCount - 1
          ? points.length - 1
          : 1 + Math.floor((bucketIndex + 1) * bucketSize);

      if (start >= end) {
        continue;
      }

      let minIndex = start;
      let maxIndex = start;

      for (let pointIndex = start + 1; pointIndex < end; pointIndex += 1) {
        if (points[pointIndex]!.value < points[minIndex]!.value) {
          minIndex = pointIndex;
        }

        if (points[pointIndex]!.value > points[maxIndex]!.value) {
          maxIndex = pointIndex;
        }
      }

      selectedIndices.add(minIndex);
      selectedIndices.add(maxIndex);
    }
  }

  const remainingBudget = maxPoints - selectedIndices.size;

  if (remainingBudget > 0) {
    const availableIndices = points
      .map((_, index) => index)
      .filter((index) => !selectedIndices.has(index));
    const fillStep = availableIndices.length / remainingBudget;

    for (
      let fillIndex = 0;
      fillIndex < remainingBudget && availableIndices.length > 0;
      fillIndex += 1
    ) {
      const candidateIndex =
        availableIndices[
          Math.min(
            availableIndices.length - 1,
            Math.floor(fillIndex * fillStep),
          )
        ];

      if (candidateIndex !== undefined) {
        selectedIndices.add(candidateIndex);
      }
    }
  }

  return [...selectedIndices]
    .sort((left, right) => left - right)
    .slice(0, maxPoints)
    .map((index) => points[index]!);
}

function downsampleMapLatLngs<T>(points: T[], maxPoints: number) {
  if (points.length <= maxPoints) {
    return points;
  }

  if (maxPoints <= 2) {
    return [points[0]!, points[points.length - 1]!];
  }

  const selectedIndices = new Set<number>([0, points.length - 1]);
  const internalBudget = maxPoints - 2;
  const step = (points.length - 2) / internalBudget;

  for (let index = 0; index < internalBudget; index += 1) {
    selectedIndices.add(1 + Math.floor(index * step));
  }

  return [...selectedIndices]
    .sort((left, right) => left - right)
    .slice(0, maxPoints)
    .map((index) => points[index]!);
}

function buildActivityMetricSeries({
  durationSeconds,
  metric,
  rawData,
  maxPoints,
}: {
  durationSeconds: number | null;
  metric: ActivityMetricKey;
  rawData: unknown[];
  maxPoints: number;
}) {
  const pointCount = rawData.length;
  const points = rawData
    .map((rawValue, index) => {
      const value = normalizeMetricValue(metric, rawValue);
      if (value === null) {
        return null;
      }

      return {
        second: mapStreamIndexToSecond({
          durationSeconds: getDurationSeconds(durationSeconds),
          index,
          pointCount,
        }),
        value,
      } satisfies ActivityMetricPoint;
    })
    .filter((point): point is ActivityMetricPoint => point !== null);

  return downsampleActivityMetricPoints(points, maxPoints);
}

export {
  buildActivityMetricSeries,
  downsampleActivityMetricPoints,
  downsampleMapLatLngs,
  mapStreamIndexToSecond,
};
