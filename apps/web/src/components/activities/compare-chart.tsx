import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@corex/ui/components/button";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/chart";

import {
  buildCompareChartData,
  getAvailableMetrics,
  metricSpecs,
  type CompareChartPoint,
} from "./utils/chart-data";
import { formatSecondsToHms } from "./utils/formatters";
import type { ActivityAnalysis, ActivityMetricKey } from "./utils/types";

type AxisSide = "left" | "right";

function getDefaultSelectedMetrics(availableMetrics: ActivityMetricKey[]) {
  const preferred: ActivityMetricKey[] = ["heartrate", "velocity_smooth"];
  const selected = preferred.filter((metric) =>
    availableMetrics.includes(metric),
  );

  if (selected.length > 0) {
    return selected;
  }

  return availableMetrics.slice(0, 2);
}

function mapMetricsToAxes(
  selectedMetrics: ActivityMetricKey[],
): Partial<Record<ActivityMetricKey, AxisSide>> {
  const leftPrimary = selectedMetrics[0];
  const rightPrimary = selectedMetrics[1];
  const axisByMetric: Partial<Record<ActivityMetricKey, AxisSide>> = {};

  for (const metric of selectedMetrics) {
    if (metric === leftPrimary) {
      axisByMetric[metric] = "left";
      continue;
    }

    if (metric === rightPrimary) {
      axisByMetric[metric] = "right";
      continue;
    }

    if (!leftPrimary || !rightPrimary) {
      axisByMetric[metric] = "left";
      continue;
    }

    const currentUnit = metricSpecs[metric].unit;
    if (metricSpecs[leftPrimary].unit === currentUnit) {
      axisByMetric[metric] = "left";
      continue;
    }

    if (metricSpecs[rightPrimary].unit === currentUnit) {
      axisByMetric[metric] = "right";
      continue;
    }

    axisByMetric[metric] = "right";
  }

  return axisByMetric;
}

function getAxisDomain(
  chartData: CompareChartPoint[],
  metrics: ActivityMetricKey[],
): [number, number] {
  const values = chartData.flatMap((point) =>
    metrics
      .map((metric) => point[metric])
      .filter((value): value is number => typeof value === "number"),
  );

  if (values.length === 0) {
    return [0, 1];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const hasAltitude = metrics.includes("fixed_altitude");
  const isHrOrCadenceOnly = metrics.every(
    (metric) => metric === "heartrate" || metric === "cadence",
  );

  if (isHrOrCadenceOnly) {
    return [Math.max(0, min - 10), max + 5];
  }

  if (hasAltitude) {
    const pad = Math.max(5, span * 0.08);
    return [min - pad, max + pad];
  }

  if (metrics.every((metric) => metric === "velocity_smooth")) {
    const pad = Math.max(0.1, span * 0.08);
    return [Math.max(0.1, min - pad), max + pad];
  }

  const pad = Math.max(2, span * 0.08);
  return [min - pad, max + pad];
}

function CompareChart({ analysis }: { analysis: ActivityAnalysis }) {
  const availableMetrics = useMemo(
    () => getAvailableMetrics(analysis),
    [analysis],
  );
  const defaultSelectedMetrics = useMemo(
    () => getDefaultSelectedMetrics(availableMetrics),
    [availableMetrics],
  );
  const [selectedMetrics, setSelectedMetrics] = useState<ActivityMetricKey[]>(
    defaultSelectedMetrics,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedMetrics((previous) => {
      const filtered = previous.filter((metric) =>
        availableMetrics.includes(metric),
      );
      if (filtered.length > 0) {
        return filtered;
      }

      return defaultSelectedMetrics;
    });
  }, [availableMetrics, defaultSelectedMetrics]);

  const chartData = useMemo(
    () => buildCompareChartData(analysis, selectedMetrics),
    [analysis, selectedMetrics],
  );
  const axisByMetric = useMemo(
    () => mapMetricsToAxes(selectedMetrics),
    [selectedMetrics],
  );
  const leftAxisMetrics = selectedMetrics.filter(
    (metric) => axisByMetric[metric] === "left",
  );
  const rightAxisMetrics = selectedMetrics.filter(
    (metric) => axisByMetric[metric] === "right",
  );
  const leftAxisDomain = getAxisDomain(chartData, leftAxisMetrics);
  const rightAxisDomain = getAxisDomain(chartData, rightAxisMetrics);

  const chartConfig = useMemo(() => {
    const entries = selectedMetrics.map((metric) => [
      metric,
      {
        color: metricSpecs[metric].color,
        label: metricSpecs[metric].label,
      },
    ]);

    return Object.fromEntries(entries) satisfies ChartConfig;
  }, [selectedMetrics]);

  if (availableMetrics.length === 0 || selectedMetrics.length === 0) {
    return null;
  }

  function toggleMetric(metric: ActivityMetricKey) {
    setSelectedMetrics((previous) => {
      if (previous.includes(metric)) {
        if (previous.length === 1) {
          return previous;
        }

        return previous.filter((current) => current !== metric);
      }

      return [...previous, metric];
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Compare</h2>
          <p className="text-muted-foreground text-sm">
            Overlay multiple metrics on the same chart.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {availableMetrics.map((metric) => {
            const isSelected = selectedMetrics.includes(metric);

            return (
              <Button
                key={metric}
                onClick={() => toggleMetric(metric)}
                size="sm"
                variant={isSelected ? "default" : "outline"}
              >
                {metricSpecs[metric].label}
              </Button>
            );
          })}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[25vh] max-h-64 w-full">
        <LineChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 8, right: 8, top: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="second"
            minTickGap={30}
            tickFormatter={(value) => formatSecondsToHms(Number(value))}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            domain={leftAxisDomain}
            tickFormatter={(value) => {
              const metric = leftAxisMetrics[0];
              if (!metric) {
                return `${value}`;
              }

              return metricSpecs[metric].formatAxisValue(Number(value));
            }}
            tickLine={false}
            tickMargin={8}
            width={56}
            yAxisId="left"
          />
          {rightAxisMetrics.length > 0 ? (
            <YAxis
              axisLine={false}
              domain={rightAxisDomain}
              orientation="right"
              tickFormatter={(value) => {
                const metric = rightAxisMetrics[0];
                if (!metric) {
                  return `${value}`;
                }

                return metricSpecs[metric].formatAxisValue(Number(value));
              }}
              tickLine={false}
              tickMargin={8}
              width={56}
              yAxisId="right"
            />
          ) : null}
          <ChartTooltip
            content={<CompareChartTooltip selectedMetrics={selectedMetrics} />}
            cursor={false}
          />

          {selectedMetrics.map((metric) => (
            <Line
              key={metric}
              connectNulls
              dataKey={metric}
              dot={false}
              stroke={`var(--color-${metric})`}
              strokeWidth={2}
              type="monotone"
              yAxisId={axisByMetric[metric] === "right" ? "right" : "left"}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function CompareChartTooltip({
  active,
  payload,
  selectedMetrics,
}: {
  active?: boolean;
  payload?: Array<{ payload: CompareChartPoint }>;
  selectedMetrics: ActivityMetricKey[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }

  const visibleMetricRows = selectedMetrics
    .map((metric) => {
      const value = row[metric];
      if (typeof value !== "number") {
        return null;
      }

      return {
        label: metricSpecs[metric].label,
        metric,
        value: metricSpecs[metric].formatTooltipValue(value),
      };
    })
    .filter(
      (
        metricRow,
      ): metricRow is {
        label: string;
        metric: ActivityMetricKey;
        value: string;
      } => metricRow !== null,
    );

  if (visibleMetricRows.length === 0) {
    return null;
  }

  return (
    <div className="border-border bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{formatSecondsToHms(row.second)}</p>
      <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-sm">
        {visibleMetricRows.map((metricRow) => (
          <div
            key={metricRow.metric}
            className="flex items-center justify-between gap-4"
          >
            <span>{metricRow.label}</span>
            <span className="font-medium">{metricRow.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { CompareChart };
