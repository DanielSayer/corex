import { HeartPulseIcon, TimerIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/chart";

import { formatSecondsToHms } from "./utils/formatters";
import { mapStreamIndexToSecond } from "./utils/chart-data";
import type { ActivityDetails } from "./utils/types";

type HrPoint = {
  heartrate: number;
  second: number;
};

const chartConfig = {
  heartrate: {
    color: "var(--chart-3)",
    label: "Heart Rate",
  },
} satisfies ChartConfig;

function HrChart({ activity }: { activity: ActivityDetails }) {
  const hrData = activity.streams.find(
    (stream) => stream.streamType === "heartrate",
  );

  if (!hrData || !hrData.data || !Array.isArray(hrData.data)) {
    return null;
  }

  const chartData = hrData.data
    .map((value, index) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }

      return {
        heartrate: value,
        second: mapStreamIndexToSecond({
          activity,
          index,
          streamPointCount: Number(hrData.data.length),
        }),
      } satisfies HrPoint;
    })
    .filter((point): point is HrPoint => point !== null);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Heart Rate</h2>
        <p className="text-muted-foreground text-sm">
          Average heart rate:{" "}
          <span className="font-bold">{activity.averageHeartrate}</span>{" "}
          <span className="text-muted-foreground text-sm">bpm</span>.
        </p>
        <p className="text-muted-foreground text-sm">
          Max heart rate:{" "}
          <span className="font-bold">{activity.maxHeartrate}</span>{" "}
          <span className="text-muted-foreground text-sm">bpm</span>.
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[25vh] max-h-64 w-full">
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 8, right: 8 }}
        >
          <defs>
            <linearGradient id="fillHeartrate" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-heartrate)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="var(--color-heartrate)"
                stopOpacity={0.1}
              />
            </linearGradient>
          </defs>

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
            domain={([dataMin, dataMax]) => [dataMin - 10, dataMax + 5]}
            tickLine={false}
            tickMargin={8}
            width={40}
          />
          <ChartTooltip cursor={false} content={<HeartrateTooltip />} />
          {activity.averageHeartrate ? (
            <ReferenceLine
              stroke="var(--color-heartrate)"
              strokeDasharray="5 5"
              y={activity.averageHeartrate}
            >
              <Label
                offset={10}
                position="left"
                value={activity.averageHeartrate}
              />
            </ReferenceLine>
          ) : null}

          <Area
            dataKey="heartrate"
            fill="url(#fillHeartrate)"
            fillOpacity={0.4}
            stroke="var(--color-heartrate)"
            strokeWidth={2}
            type="natural"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function HeartrateTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HrPoint; value: number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const { heartrate, second } = payload[0].payload;

  return (
    <div className="border-border bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="text-sm font-medium">Heart Rate</p>
      <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-sm">
        <span className="flex items-center gap-1.5">
          <HeartPulseIcon className="size-3.5" /> {heartrate} bpm
        </span>
        <span className="flex items-center gap-1.5">
          <TimerIcon className="size-3.5" /> {formatSecondsToHms(second)}
        </span>
      </div>
    </div>
  );
}

export { HrChart };
