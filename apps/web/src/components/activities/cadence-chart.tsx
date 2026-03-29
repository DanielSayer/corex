import { FootprintsIcon, TimerIcon } from "lucide-react";
import { CartesianGrid, Scatter, ScatterChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/chart";

import { formatSecondsToHms } from "./utils/formatters";
import { mapStreamIndexToSecond } from "./utils/chart-data";
import type { ActivityDetails } from "./utils/types";

type CadencePoint = {
  cadence: number;
  second: number;
};

type ScatterShapeProps = {
  cx?: number;
  cy?: number;
  payload?: CadencePoint;
};

const chartConfig = {
  cadence: {
    color: "var(--chart-2)",
    label: "Cadence",
  },
} satisfies ChartConfig;

function getCadenceColor(cadence: number) {
  if (cadence > 183) {
    return "#a855f7";
  }

  if (cadence >= 174) {
    return "#3b82f6";
  }

  if (cadence >= 164) {
    return "#22c55e";
  }

  if (cadence >= 153) {
    return "#f97316";
  }

  return "#ef4444";
}

function CadenceChart({ activity }: { activity: ActivityDetails }) {
  const cadenceStream = activity.streams.find(
    (stream) => stream.streamType === "cadence",
  );

  if (
    !cadenceStream ||
    !cadenceStream.data ||
    !Array.isArray(cadenceStream.data)
  ) {
    return null;
  }

  const chartData: CadencePoint[] = cadenceStream.data
    .map((value, index) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
        return null;
      }

      return {
        cadence: value * 2,
        second: mapStreamIndexToSecond({
          activity,
          index,
          streamPointCount: Number(cadenceStream.data.length),
        }),
      };
    })
    .filter((point): point is CadencePoint => point !== null);

  if (chartData.length === 0) {
    return null;
  }

  const renderDot = ({ cx, cy, payload }: ScatterShapeProps) => {
    if (!payload || cx === undefined || cy === undefined) {
      return <g />;
    }

    return (
      <circle cx={cx} cy={cy} r={3} fill={getCadenceColor(payload.cadence)} />
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Cadence</h2>
        <p className="text-muted-foreground text-sm">
          Average cadence:{" "}
          <span className="font-bold">
            {Math.round(activity.averageCadence ?? 0)}
          </span>{" "}
          <span className="text-muted-foreground text-sm">spm</span>.
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[25vh] max-h-64 w-full">
        <ScatterChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 8, right: 8 }}
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
            domain={([dataMin, dataMax]) => [
              Math.max(80, dataMin - 5),
              dataMax + 5,
            ]}
            tickLine={false}
            tickMargin={8}
            width={40}
          />
          <ChartTooltip cursor={false} content={<CadenceTooltip />} />
          <Scatter dataKey="cadence" shape={renderDot} />
        </ScatterChart>
      </ChartContainer>
    </div>
  );
}

function CadenceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CadencePoint; value: number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const { cadence, second } = payload[0].payload;

  return (
    <div className="border-border bg-background rounded-lg border px-3 py-2 shadow-md">
      <p className="text-sm font-medium">Cadence</p>
      <div className="text-muted-foreground mt-1 flex flex-col gap-0.5 text-sm">
        <span className="flex items-center gap-1.5">
          <FootprintsIcon className="size-3.5" /> {cadence} spm
        </span>
        <span className="flex items-center gap-1.5">
          <TimerIcon className="size-3.5" /> {formatSecondsToHms(second)}
        </span>
      </div>
    </div>
  );
}

export { CadenceChart };
