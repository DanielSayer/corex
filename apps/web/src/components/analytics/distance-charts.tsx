import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { CardAction } from "@corex/ui/components/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@corex/ui/components/toggle-group";

import { ChartContainer, ChartTooltip } from "@/components/chart";

import { distanceChartConfig } from "./constants";
import { EmptyPanel, SectionCard, TooltipCard } from "./shared";
import type { AnalyticsView, DistanceGranularity } from "./types";

const chartFrameClassName =
  "h-80 w-full [&_.recharts-cartesian-axis-tick_text]:fill-[#8b93b2] [&_.recharts-cartesian-grid_line]:stroke-white/6 [&_.recharts-dot]:stroke-[#0f1522]";

export function DistanceTrendCard({
  data,
  distanceGranularity,
  onGranularityChange,
}: {
  data: AnalyticsView;
  distanceGranularity: DistanceGranularity;
  onGranularityChange: (value: string) => void;
}) {
  const chartData = data.distanceTrends[distanceGranularity].map((bucket) => ({
    label: bucket.label,
    distanceKm: Number((bucket.distanceMeters / 1000).toFixed(2)),
  }));

  return (
    <SectionCard
      title="Distance trends"
      description={`${distanceGranularity === "month" ? "Monthly" : "Weekly"} distance (km).`}
      action={
        <CardAction>
          <ToggleGroup
            value={[distanceGranularity]}
            onValueChange={(value) => {
              const selected = value[0];
              if (selected) {
                onGranularityChange(selected);
              }
            }}
            variant="outline"
            className="rounded-full border border-white/10 bg-white/[0.03] p-1"
          >
            <ToggleGroupItem
              value="month"
              className="rounded-full border-0 px-4 text-[#97a0c0] data-[state=on]:!bg-white/10 data-[state=on]:text-white"
            >
              Month
            </ToggleGroupItem>
            <ToggleGroupItem
              value="week"
              className="rounded-full border-0 px-4 text-[#97a0c0] data-[state=on]:!bg-white/10 data-[state=on]:text-white"
            >
              Week
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      }
      contentClassName="pt-5"
    >
      <ChartContainer
        config={distanceChartConfig}
        className={chartFrameClassName}
      >
        <BarChart accessibilityLayer data={chartData} margin={{ top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval={distanceGranularity === "week" ? 3 : 0}
            minTickGap={20}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value) => `${Number(value).toFixed(0)}`}
            tickLine={false}
            tickMargin={12}
            width={36}
          />
          <ChartTooltip content={<DistanceTrendTooltip />} cursor={false} />
          <Bar
            dataKey="distanceKm"
            fill="var(--color-distance)"
            radius={[8, 8, 0, 0]}
            maxBarSize={distanceGranularity === "week" ? 18 : 28}
          />
        </BarChart>
      </ChartContainer>
    </SectionCard>
  );
}

export function CumulativeDistanceCard({ data }: { data: AnalyticsView }) {
  const latestMonthIndex = data.distanceTrends.month.reduce(
    (latestIndex, bucket, index) =>
      bucket.distanceMeters > 0 ? index : latestIndex,
    -1,
  );
  const visibleBuckets =
    latestMonthIndex >= 0
      ? data.distanceTrends.month.slice(0, latestMonthIndex + 1)
      : [];
  const chartData = visibleBuckets.reduce<
    Array<{ label: string; cumulativeKm: number }>
  >((points, bucket) => {
    const previousCumulativeKm = points.at(-1)?.cumulativeKm ?? 0;
    const cumulativeKm = Number(
      (previousCumulativeKm + bucket.distanceMeters / 1000).toFixed(2),
    );

    points.push({
      label: bucket.label,
      cumulativeKm,
    });

    return points;
  }, []);

  return (
    <SectionCard
      title="Cumulative distance"
      description="Total distance over time (km)."
      contentClassName="pt-5"
    >
      {chartData.length > 0 ? (
        <div className={chartFrameClassName}>
          <ResponsiveContainer>
            <AreaChart accessibilityLayer data={chartData} margin={{ top: 8 }}>
              <defs>
                <linearGradient
                  id="analytics-cumulative-fill"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#5b5df0" stopOpacity={0.42} />
                  <stop offset="100%" stopColor="#5b5df0" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="0"
              />
              <XAxis
                axisLine={false}
                dataKey="label"
                tick={{ fill: "#8b93b2" }}
                tickLine={false}
                tickMargin={12}
              />
              <YAxis
                axisLine={false}
                domain={[0, "dataMax + 5"]}
                tick={{ fill: "#8b93b2" }}
                tickFormatter={(value) => `${Number(value).toFixed(0)}`}
                tickLine={false}
                tickMargin={12}
                width={36}
              />
              <ChartTooltip content={<DistanceTrendTooltip />} cursor={false} />
              <Area
                dataKey="cumulativeKm"
                fill="url(#analytics-cumulative-fill)"
                stroke="none"
                type="monotone"
              />
              <Line
                dataKey="cumulativeKm"
                dot={{ fill: "#6366f1", r: 4 }}
                stroke="#6366f1"
                strokeWidth={2.5}
                type="monotone"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyPanel
          title="No cumulative distance yet"
          description="Import some running history for the selected year to see the running total."
        />
      )}
    </SectionCard>
  );
}

function DistanceTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <TooltipCard
      label={label ?? ""}
      value={`${Number(payload[0]?.value ?? 0).toFixed(2)} km`}
    />
  );
}
