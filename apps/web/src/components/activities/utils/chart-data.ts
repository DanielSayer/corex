import type {
  ActivityAnalysis,
  ActivityMetricKey,
  ActivityMetricPoint,
} from "./types";
import { formatSpeedToMinsPerKm } from "./formatters";

const metricKeys = [
  "heartrate",
  "cadence",
  "velocity_smooth",
  "fixed_altitude",
] as const satisfies readonly ActivityMetricKey[];

type MetricSpec = {
  label: string;
  unit: string;
  color: string;
  formatAxisValue: (value: number) => string;
  formatTooltipValue: (value: number) => string;
};

type CompareChartPoint = {
  second: number;
} & Partial<Record<ActivityMetricKey, number>>;

const metricSpecs: Record<ActivityMetricKey, MetricSpec> = {
  heartrate: {
    label: "Heart Rate",
    unit: "bpm",
    color: "var(--chart-3)",
    formatAxisValue: (value) => `${Math.round(value)}`,
    formatTooltipValue: (value) => `${Math.round(value)} bpm`,
  },
  cadence: {
    label: "Cadence",
    unit: "spm",
    color: "var(--chart-2)",
    formatAxisValue: (value) => `${Math.round(value)}`,
    formatTooltipValue: (value) => `${Math.round(value)} spm`,
  },
  velocity_smooth: {
    label: "Pace",
    unit: "/km",
    color: "var(--chart-4)",
    formatAxisValue: (value) => formatSpeedToMinsPerKm(value),
    formatTooltipValue: (value) => `${formatSpeedToMinsPerKm(value)}/km`,
  },
  fixed_altitude: {
    label: "Elevation",
    unit: "m",
    color: "var(--chart-5)",
    formatAxisValue: (value) => `${Math.round(value)}`,
    formatTooltipValue: (value) => `${Math.round(value)} m`,
  },
};

function getMetricSeries(
  analysis: ActivityAnalysis,
  metric: ActivityMetricKey,
): ActivityMetricPoint[] {
  return analysis[metric] ?? [];
}

function getAvailableMetrics(analysis: ActivityAnalysis): ActivityMetricKey[] {
  return metricKeys.filter(
    (metric) => getMetricSeries(analysis, metric).length > 0,
  );
}

function buildCompareChartData(
  analysis: ActivityAnalysis,
  selectedMetrics: ActivityMetricKey[],
): CompareChartPoint[] {
  const rows = new Map<number, CompareChartPoint>();

  for (const metric of selectedMetrics) {
    const series = getMetricSeries(analysis, metric);
    for (const point of series) {
      const current = rows.get(point.second) ?? { second: point.second };
      current[metric] = point.value;
      rows.set(point.second, current);
    }
  }

  return [...rows.values()].sort((left, right) => left.second - right.second);
}

export {
  buildCompareChartData,
  getAvailableMetrics,
  getMetricSeries,
  metricKeys,
  metricSpecs,
};
export type { CompareChartPoint, MetricSpec };
