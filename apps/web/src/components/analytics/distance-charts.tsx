import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
      description={`Compare run volume across the selected year by ${
        distanceGranularity === "month" ? "month" : "week"
      }.`}
      className="border border-border/70"
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
          >
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
            <ToggleGroupItem value="month">Month</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      }
    >
      <ChartContainer config={distanceChartConfig} className="h-80 w-full">
        <BarChart accessibilityLayer data={chartData} margin={{ top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            interval={distanceGranularity === "week" ? 3 : 0}
            minTickGap={20}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            tickFormatter={(value) => `${Number(value).toFixed(0)} km`}
            tickLine={false}
            tickMargin={8}
            width={56}
          />
          <ChartTooltip content={<DistanceTrendTooltip />} cursor={false} />
          <Bar
            dataKey="distanceKm"
            fill="var(--color-distance)"
            radius={[12, 12, 4, 4]}
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
      description="Running total for the selected year, ending at the latest month with imported distance."
      className="border border-border/70"
    >
      {chartData.length > 0 ? (
        <ChartContainer config={distanceChartConfig} className="h-80 w-full">
          <LineChart accessibilityLayer data={chartData} margin={{ top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              axisLine={false}
              domain={[0, "dataMax + 5"]}
              tickFormatter={(value) => `${Number(value).toFixed(0)} km`}
              tickLine={false}
              tickMargin={8}
              width={56}
            />
            <ChartTooltip content={<DistanceTrendTooltip />} cursor={false} />
            <Line
              dataKey="cumulativeKm"
              dot={{ fill: "var(--color-distance)", r: 4 }}
              stroke="var(--color-distance)"
              strokeWidth={3}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
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
