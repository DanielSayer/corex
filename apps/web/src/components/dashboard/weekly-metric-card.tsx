import { Card } from "@corex/ui/components/card";
import { cn } from "@corex/ui/lib/utils";
import { FootprintsIcon, TimerIcon } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardRouterOutputs } from "@/utils/types";
import { formatPaceSecondsPerKm } from "@/components/activities/utils/formatters";

type DashboardData = DashboardRouterOutputs["get"];
type SeriesPoint = DashboardData["weekly"]["distance"]["series"][number];
type MetricKind = "distance" | "pace";

type WeeklyMetricCardProps = {
  metric: MetricKind;
  currentValue: string;
  unit: string;
  deltaLabel: string;
  deltaPositive: boolean;
  averageLabel: string;
  rangeLabel: string;
  series: SeriesPoint[];
};

function formatChartValue(metric: MetricKind, value: number) {
  if (metric === "distance") {
    return `${(value / 1000).toFixed(1)} km`;
  }

  return formatPaceSecondsPerKm(value);
}

function formatYAxisValue(metric: MetricKind, value: number) {
  if (metric === "distance") {
    return `${Math.round(value / 1000)}`;
  }

  return formatPaceSecondsPerKm(value, { showUnit: false });
}

function MetricTooltip({
  active,
  metric,
  payload,
}: {
  active?: boolean;
  metric: MetricKind;
  payload?: Array<{ value?: number | null }>;
}) {
  const value = payload?.[0]?.value;

  if (!active || value == null) {
    return null;
  }

  const Icon = metric === "distance" ? FootprintsIcon : TimerIcon;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium">
        {metric === "distance" ? "Distance" : "Pace"}
      </p>
      <div className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
        <span className="flex items-center gap-1.5 text-xs">
          <Icon className="size-3.5" />
          {formatChartValue(metric, value)}
        </span>
      </div>
    </div>
  );
}

export function WeeklyMetricCard({
  averageLabel,
  currentValue,
  deltaLabel,
  deltaPositive,
  metric,
  rangeLabel,
  series,
  unit,
}: WeeklyMetricCardProps) {
  const chartData = useMemo(
    () =>
      series.map((point) => ({
        label: point.label,
        value: point.value,
        weekStart: point.weekStart,
      })),
    [series],
  );
  const averageValue = useMemo(() => {
    const values = series
      .map((point) => point.value)
      .filter((value): value is number => value != null);

    if (values.length === 0) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [series]);
  const hasTrend = chartData.some((point) => point.value != null);

  return (
    <Card className="gap-0 p-4 py-4">
      <p className="-mb-2 text-right text-xs text-zinc-500">{rangeLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="mt-auto mb-2 flex flex-col">
          <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
            This week
          </p>
          <div className="flex items-end gap-1.5">
            <span className="text-4xl leading-none font-bold">
              {currentValue}
            </span>
            <span className="mb-0.5 text-lg font-medium text-zinc-400">
              {unit}
            </span>
          </div>

          <div className="mt-4 flex gap-4">
            <div>
              <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
                vs last week
              </p>
              <p
                className={cn("text-sm font-semibold", {
                  "text-emerald-400": deltaPositive,
                  "text-red-400": !deltaPositive,
                })}
              >
                {deltaLabel}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-wider text-zinc-500 uppercase">
                Avg/week
              </p>
              <p className="text-sm font-semibold text-foreground/90">
                {averageLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="h-28 sm:col-span-2">
          {hasTrend ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 4, right: 4, left: -32, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={`${metric}Grad`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  interval="preserveStartEnd"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  tickFormatter={(value) => formatYAxisValue(metric, value)}
                  tickLine={false}
                />
                {averageValue == null ? null : (
                  <ReferenceLine
                    stroke="#52525b"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    y={averageValue}
                  />
                )}
                <Tooltip
                  content={<MetricTooltip metric={metric} />}
                  cursor={false}
                />
                <Area
                  activeDot={{
                    fill: "var(--chart-1)",
                    r: 5,
                    stroke: "#065f46",
                    strokeWidth: 2,
                  }}
                  connectNulls
                  dataKey="value"
                  dot={{ fill: "var(--chart-1)", r: 3, strokeWidth: 0 }}
                  fill={`url(#${metric}Grad)`}
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No trend yet
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
