import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { CardAction } from "@corex/ui/components/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@corex/ui/components/select";

import { formatSecondsToHms } from "@/components/activities/utils/formatters";
import { ChartContainer, ChartTooltip } from "@/components/chart";

import { prChartConfig } from "./constants";
import { getDistanceLabel } from "./utils";
import { EmptyPanel, SectionCard, TooltipCard } from "./shared";
import type { AnalyticsView } from "./types";

function formatChartDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const roundedSeconds = Math.round(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function PrTrendCard({
  data,
  selectedDistance,
  onDistanceChange,
}: {
  data: AnalyticsView;
  selectedDistance: number;
  onDistanceChange: (value: string) => void;
}) {
  const selectedSeries =
    data.prTrends.series.find(
      (series) => series.distanceMeters === selectedDistance,
    ) ?? data.prTrends.series[0];
  const selectedDistanceLabel = selectedSeries
    ? getDistanceLabel(selectedSeries.distanceMeters)
    : getDistanceLabel(selectedDistance);
  const chartData =
    selectedSeries?.months.map((month) => ({
      label: month.label,
      durationSeconds: month.durationSeconds,
    })) ?? [];
  const hasPrData =
    selectedSeries?.months.some(
      (month) => typeof month.durationSeconds === "number",
    ) ?? false;

  return (
    <SectionCard
      title="PR trend"
      description="Best time (min) for tracked PR distances."
      action={
        <CardAction>
          <Select
            value={String(selectedSeries?.distanceMeters ?? selectedDistance)}
            onValueChange={(value) => {
              if (value) {
                onDistanceChange(value);
              }
            }}
          >
            <SelectTrigger className="min-w-36 border-white/10 bg-white/[0.04] text-white shadow-none hover:bg-white/[0.06]">
              <SelectValue>{selectedDistanceLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#111827] text-white ring-white/10">
              <SelectGroup>
                {data.prTrends.distances.map((distance) => (
                  <SelectItem key={distance} value={String(distance)}>
                    {getDistanceLabel(distance)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      }
      contentClassName="pt-5"
    >
      {selectedSeries && hasPrData ? (
        <ChartContainer
          config={prChartConfig}
          className="h-80 w-full [&_.recharts-cartesian-axis-tick_text]:fill-[#8b93b2] [&_.recharts-cartesian-grid_line]:stroke-white/6 [&_.recharts-dot]:stroke-[#0f1522]"
        >
          <LineChart accessibilityLayer data={chartData} margin={{ top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="0" />
            <XAxis
              axisLine={false}
              dataKey="label"
              tickLine={false}
              tickMargin={12}
            />
            <YAxis
              axisLine={false}
              domain={["dataMin - 30", "dataMax + 30"]}
              tickFormatter={(value) => formatChartDuration(Number(value))}
              tickLine={false}
              tickMargin={12}
              width={48}
            />
            <ChartTooltip content={<PrTrendTooltip />} cursor={false} />
            <Line
              connectNulls={false}
              dataKey="durationSeconds"
              dot={{ fill: "var(--color-duration)", r: 4 }}
              stroke="var(--color-duration)"
              strokeWidth={2.5}
              type="linear"
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <EmptyPanel
          title="No PRs yet"
          description="Monthly PR trends will appear after best efforts have been reconciled into monthly bests."
        />
      )}
    </SectionCard>
  );
}

function PrTrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = payload[0]?.value;

  return (
    <TooltipCard
      label={label ?? ""}
      value={typeof value === "number" ? formatSecondsToHms(value) : "No PR"}
    />
  );
}
