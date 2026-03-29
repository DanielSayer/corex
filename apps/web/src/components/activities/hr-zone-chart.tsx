import { cn } from "@/lib/utils";

import { formatSecondsToHms } from "./utils/formatters";

const ZONE_CONFIG = [
  { color: "bg-gray-400", name: "Recovery", pctRange: "0 - 84%", zone: "Z1" },
  {
    color: "border-blue-500 bg-blue-500 dark:bg-blue-300",
    name: "Aerobic",
    pctRange: "85% - 89%",
    zone: "Z2",
  },
  {
    color: "border-green-500 bg-green-500 dark:bg-green-300",
    name: "Tempo",
    pctRange: "90% - 94%",
    zone: "Z3",
  },
  {
    color: "border-yellow-400 bg-yellow-500 dark:bg-yellow-200",
    name: "SubThreshold",
    pctRange: "95% - 99%",
    zone: "Z4",
  },
  {
    color: "border-orange-500 bg-orange-500 dark:bg-orange-300",
    name: "SuperThreshold",
    pctRange: "100% - 102%",
    zone: "Z5",
  },
  {
    color: "border-red-500 bg-red-500 dark:bg-red-300",
    name: "Aerobic Capacity",
    pctRange: "103% - 105%",
    zone: "Z6",
  },
  {
    color: "border-purple-600 bg-purple-500 dark:bg-purple-400",
    name: "Anaerobic",
    pctRange: "106%+",
    zone: "Z7",
  },
] as const;

type HrZoneChartProps = {
  hrZones: number[] | null;
  hrZoneTimes: number[] | null;
};

function HrZoneChart({ hrZones, hrZoneTimes }: HrZoneChartProps) {
  if (!hrZones || !hrZoneTimes || hrZoneTimes.length === 0) {
    return null;
  }

  const totalTime = hrZoneTimes.reduce((sum, value) => sum + value, 0);
  const maxTime = Math.max(...hrZoneTimes);

  const getHrRange = (index: number) => {
    if (index === 0) {
      return `0 - ${hrZones[0]}`;
    }

    return `${hrZones[index - 1] + 1} - ${hrZones[index]}`;
  };

  return (
    <div>
      <h2 className="mb-4 text-3xl font-bold tracking-tight">
        Heart Rate Zones
      </h2>
      <div className="space-y-2">
        {ZONE_CONFIG.map((config, index) => {
          const time = hrZoneTimes[index] ?? 0;
          const pct = totalTime > 0 ? (time / totalTime) * 100 : 0;
          const barWidth = maxTime > 0 ? (time / maxTime) * 100 : 0;

          return (
            <div
              key={config.zone}
              className="grid items-center gap-2 text-base"
              style={{
                gridTemplateColumns: "28px 150px 100px 70px 1fr 70px 70px",
              }}
            >
              <span className="text-muted-foreground font-semibold">
                {config.zone}
              </span>
              <span className="truncate font-medium">{config.name}</span>
              <span className="text-muted-foreground">{config.pctRange}</span>
              <span className="text-muted-foreground">{getHrRange(index)}</span>
              <div className="bg-muted h-4 w-full overflow-hidden rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full border-2 transition-all duration-700 ease-out",
                    config.color,
                  )}
                  style={{
                    transitionDelay: `${index * 80}ms`,
                    width: `${barWidth}%`,
                  }}
                />
              </div>
              <span className="text-right font-medium">
                {formatSecondsToHms(time)}
              </span>
              <span className="text-muted-foreground text-right font-medium">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { HrZoneChart };
