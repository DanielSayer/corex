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

  return (
    <SectionCard
      title="PR trends"
      description="Best monthly result for the selected PR distance across the chosen year."
      className="border border-border/70"
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
            <SelectTrigger className="min-w-32">
              <SelectValue>{selectedDistanceLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
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
    >
      {selectedSeries ? (
        <ChartContainer config={prChartConfig} className="h-80 w-full">
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
              domain={["dataMin - 30", "dataMax + 30"]}
              tickFormatter={(value) => formatSecondsToHms(Number(value))}
              tickLine={false}
              tickMargin={8}
              width={64}
            />
            <ChartTooltip content={<PrTrendTooltip />} cursor={false} />
            <Line
              connectNulls={false}
              dataKey="durationSeconds"
              dot={{ fill: "var(--color-duration)", r: 4 }}
              stroke="var(--color-duration)"
              strokeWidth={3}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <EmptyPanel
          title="No PRs yet"
          description="Monthly PR trends will appear after run best efforts have been reconciled into monthly bests."
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
