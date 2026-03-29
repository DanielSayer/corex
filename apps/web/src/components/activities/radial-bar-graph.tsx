import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/chart";

type RadialBarGraphProps = {
  displayValue?: number;
  label: string;
  value: number;
  variant: 1 | 2 | 3 | 4 | 5;
};

const colorVariants = {
  1: "var(--color-chart-1)",
  2: "var(--color-chart-2)",
  3: "var(--color-chart-3)",
  4: "var(--color-chart-4)",
  5: "var(--color-chart-5)",
} as const;

function RadialBarGraph({
  displayValue,
  label,
  value,
  variant,
}: RadialBarGraphProps) {
  const chartVariant = colorVariants[variant];
  const chartData = [{ fill: chartVariant, value }];
  const chartConfig = {
    value: {
      color: chartVariant,
      label,
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="aspect-square w-full">
      <RadialBarChart
        data={chartData}
        endAngle={(value / 100) * 360}
        innerRadius={60}
        outerRadius={80}
        startAngle={0}
      >
        <PolarGrid
          className="first:fill-muted last:fill-background"
          gridType="circle"
          polarRadius={[64, 56]}
          radialLines={false}
          stroke="none"
        />
        <RadialBar background cornerRadius={10} dataKey="value" />
        <PolarRadiusAxis axisLine={false} tick={false} tickLine={false}>
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                return null;
              }

              return (
                <text
                  dominantBaseline="middle"
                  textAnchor="middle"
                  x={viewBox.cx}
                  y={viewBox.cy}
                >
                  <tspan
                    className="fill-muted-foreground"
                    x={viewBox.cx}
                    y={(viewBox.cy || 0) + 24}
                  >
                    {label}
                  </tspan>
                  <tspan
                    className="fill-foreground text-4xl font-bold"
                    x={viewBox.cx}
                    y={viewBox.cy}
                  >
                    {displayValue ??
                      Math.round(chartData[0].value).toLocaleString()}
                  </tspan>
                </text>
              );
            }}
          />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  );
}

export { RadialBarGraph };
