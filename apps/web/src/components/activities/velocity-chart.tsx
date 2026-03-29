import { GaugeIcon, TimerIcon } from "lucide-react";
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

import { formatSecondsToHms, formatSpeedToMinsPerKm } from "./utils/formatters";
import { mapStreamIndexToSecond } from "./utils/chart-data";
import type { ActivityDetails } from "./utils/types";

type VelocityPoint = {
  second: number;
  velocity: number;
};

const chartConfig = {
  velocity: {
    color: "var(--chart-4)",
    label: "Pace",
  },
} satisfies ChartConfig;

function VelocityChart({ activity }: { activity: ActivityDetails }) {
  const velocityStream = activity.streams.find(
    (stream) => stream.streamType === "velocity_smooth",
  );

  if (
    !velocityStream ||
    !velocityStream.data ||
    !Array.isArray(velocityStream.data)
  ) {
    return null;
  }

  const chartData: VelocityPoint[] = velocityStream.data
    .map((value, index) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return null;
      }

      return {
        second: mapStreamIndexToSecond({
          activity,
          index,
          streamPointCount: Number(velocityStream.data.length),
        }),
        velocity: value,
      };
    })
    .filter((point): point is VelocityPoint => point !== null);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Pace</h2>
        <p className="text-muted-foreground text-sm">
          Average pace:{" "}
          <span className="font-bold">
            {formatSpeedToMinsPerKm(activity.averageSpeed)}
          </span>{" "}
          <span className="text-muted-foreground text-sm">/km</span>.
        </p>
        <p className="text-muted-foreground text-sm">
          Max pace:{" "}
          <span className="font-bold">
            {formatSpeedToMinsPerKm(activity.maxSpeed)}
          </span>{" "}
          <span className="text-muted-foreground text-sm">/km</span>.
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[25vh] max-h-64 w-full">
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 8, right: 8 }}
        >
          <defs>
            <linearGradient id="fillVelocity" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-velocity)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="var(--color-velocity)"
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
            domain={([, dataMax]) => [0, dataMax + 0.5]}
            tickFormatter={(value) => formatSpeedToMinsPerKm(Number(value))}
            tickLine={false}
            tickMargin={8}
            width={56}
          />
          <ChartTooltip cursor={false} content={<VelocityTooltip />} />
          <ReferenceLine
            stroke="var(--color-velocity)"
            strokeDasharray="5 5"
            y={activity.averageSpeed ?? undefined}
          >
            <Label
              offset={10}
              position="left"
              value={formatSpeedToMinsPerKm(activity.averageSpeed)}
            />
          </ReferenceLine>

          <Area
            dataKey="velocity"
            fill="url(#fillVelocity)"
            fillOpacity={0.4}
            stroke="var(--color-velocity)"
            strokeWidth={2}
            type="natural"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function VelocityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: VelocityPoint; value: number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const { second, velocity } = payload[0].payload;

  return (
    <div className="border-border bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="text-sm font-medium">Pace</p>
      <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-sm">
        <span className="flex items-center gap-1.5">
          <GaugeIcon className="size-3.5" /> {formatSpeedToMinsPerKm(velocity)}
          /km
        </span>
        <span className="flex items-center gap-1.5">
          <TimerIcon className="size-3.5" /> {formatSecondsToHms(second)}
        </span>
      </div>
    </div>
  );
}

export { VelocityChart };
