import { getLocalDateKey } from "../goal-progress/timezones";

export type AnalyticsOverviewMonthBucket = {
  key: string;
  label: string;
  distanceMeters: number;
};

export function calculateDeltaPercent(input: {
  currentDistanceMeters: number;
  comparisonDistanceMeters: number;
}) {
  if (input.comparisonDistanceMeters === 0) {
    return null;
  }

  return (
    ((input.currentDistanceMeters - input.comparisonDistanceMeters) /
      input.comparisonDistanceMeters) *
    100
  );
}

export function getAnalyticsYearContext(input: {
  selectedYear: number;
  timezone: string;
  now: Date;
}) {
  const currentDateKey = getLocalDateKey(input.now, input.timezone);
  const currentYear = Number(currentDateKey.slice(0, 4));
  const isPartialYear = input.selectedYear === currentYear;
  const comparisonYear = input.selectedYear - 1;
  const cutoffDateKey = isPartialYear
    ? currentDateKey
    : `${input.selectedYear}-12-31`;
  const comparisonCutoffDateKey = isPartialYear
    ? `${comparisonYear}${currentDateKey.slice(4)}`
    : `${comparisonYear}-12-31`;
  const elapsedMonthCount = isPartialYear
    ? Number(cutoffDateKey.slice(5, 7))
    : 12;

  return {
    comparisonYear,
    cutoffDateKey,
    comparisonCutoffDateKey,
    elapsedMonthCount,
    isPartialYear,
  };
}

export function buildConsistency(input: {
  monthBuckets: AnalyticsOverviewMonthBucket[];
  elapsedMonthCount: number;
}) {
  const activeMonthCount = input.monthBuckets.filter(
    (bucket) => bucket.distanceMeters > 0,
  ).length;
  const ratio =
    input.elapsedMonthCount > 0
      ? activeMonthCount / input.elapsedMonthCount
      : 0;

  return {
    activeMonthCount,
    elapsedMonthCount: input.elapsedMonthCount,
    ratio,
    percent: Math.round(ratio * 100),
    months: input.monthBuckets.map((bucket, index) => ({
      key: bucket.key,
      label: bucket.label,
      isElapsed: index < input.elapsedMonthCount,
      isActive: bucket.distanceMeters > 0,
    })),
  };
}

export function buildActiveMonthSummary(input: {
  monthBuckets: AnalyticsOverviewMonthBucket[];
  elapsedMonthCount: number;
}) {
  const activeMonths = input.monthBuckets.filter(
    (bucket) => bucket.distanceMeters > 0,
  );
  const first = activeMonths[0];
  const last = activeMonths.at(-1);

  return {
    count: activeMonths.length,
    elapsedCount: input.elapsedMonthCount,
    rangeLabel:
      first && last
        ? first.key === last.key
          ? first.label
          : `${first.label} - ${last.label}`
        : null,
  };
}
