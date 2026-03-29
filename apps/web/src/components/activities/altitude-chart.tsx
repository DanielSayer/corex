import { MountainIcon, TimerIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/chart";

import { formatSecondsToHms } from "./utils/formatters";
import { mapStreamIndexToSecond } from "./utils/chart-data";
import type { ActivityDetails } from "./utils/types";

type AltitudePoint = {
  altitude: number;
  second: number;
};

const chartConfig = {
  altitude: {
    color: "var(--chart-5)",
    label: "Altitude",
  },
} satisfies ChartConfig;

function AltitudeChart({ activity }: { activity: ActivityDetails }) {
  const altitudeStream = activity.streams.find(
    (stream) => stream.streamType === "fixed_altitude",
  );

  if (
    !altitudeStream ||
    !altitudeStream.data ||
    !Array.isArray(altitudeStream.data)
  ) {
    return null;
  }

  const chartData: AltitudePoint[] = altitudeStream.data
    .map((value, index) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }

      return {
        altitude: value,
        second: mapStreamIndexToSecond({
          activity,
          index,
          streamPointCount: Number(altitudeStream.data.length),
        }),
      };
    })
    .filter((point): point is AltitudePoint => point !== null);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Elevation</h2>
        <p className="text-muted-foreground text-sm">
          Total elevation gain:{" "}
          <span className="font-bold">
            {Math.round(activity.totalElevationGain ?? 0)}
          </span>{" "}
          <span className="text-muted-foreground text-sm">m</span>.
        </p>
        <p className="text-muted-foreground text-sm">
          Total elevation loss:{" "}
          <span className="font-bold">
            {Math.round(activity.totalElevationLoss ?? 0)}
          </span>{" "}
          <span className="text-muted-foreground text-sm">m</span>.
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[25vh] max-h-64 w-full">
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 8, right: 8 }}
        >
          <defs>
            <linearGradient id="fillAltitude" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-altitude)"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="var(--color-altitude)"
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
          <YAxis axisLine={false} tickLine={false} tickMargin={8} width={48} />
          <ChartTooltip cursor={false} content={<AltitudeTooltip />} />

          <Area
            dataKey="altitude"
            fill="url(#fillAltitude)"
            fillOpacity={0.4}
            stroke="var(--color-altitude)"
            strokeWidth={2}
            type="natural"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function AltitudeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AltitudePoint; value: number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const { altitude, second } = payload[0].payload;

  return (
    <div className="border-border bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="text-sm font-medium">Elevation</p>
      <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-sm">
        <span className="flex items-center gap-1.5">
          <MountainIcon className="size-3.5" /> {Math.round(altitude)} m
        </span>
        <span className="flex items-center gap-1.5">
          <TimerIcon className="size-3.5" /> {formatSecondsToHms(second)}
        </span>
      </div>
    </div>
  );
}

export { AltitudeChart };
