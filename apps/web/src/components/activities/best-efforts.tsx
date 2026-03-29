import { TrendingUpIcon, TrophyIcon } from "lucide-react";

import { Medal } from "@/components/medal";

import {
  BEST_EFFORT_TARGET_DISTANCES_METERS,
  DISTANCE_CONFIG,
} from "./utils/best-efforts";
import { formatPace, formatSecondsToHms } from "./utils/formatters";
import type { BestEffort } from "./utils/types";

type BestEffortsProps = {
  efforts: BestEffort[];
};

function BestEfforts({ efforts }: BestEffortsProps) {
  const effortsByDistance = new Map(
    efforts.map((effort) => [effort.targetDistanceMeters, effort]),
  );
  const hasAnyEffort = efforts.length > 0;

  return (
    <div>
      <p className="text-muted-foreground mb-6 flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
        <TrophyIcon className="size-4 text-yellow-500" />
        Best Efforts
      </p>

      {!hasAnyEffort ? (
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
          <TrendingUpIcon className="h-8 w-8 opacity-40" />
          <p className="text-sm">
            No best efforts recorded yet. Complete some activities to see your
            records here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4">
          {BEST_EFFORT_TARGET_DISTANCES_METERS.map((distance) => {
            const effort = effortsByDistance.get(distance);
            const config = DISTANCE_CONFIG[distance];

            if (!effort) {
              return null;
            }

            return (
              <div
                key={distance}
                className="flex flex-col items-center gap-1.5"
              >
                <Medal
                  color={config.color}
                  glow={config.glow}
                  label={config.short}
                  ring={config.ring}
                />
                <span className="font-mono text-sm leading-tight font-semibold tabular-nums">
                  {formatSecondsToHms(effort.durationSeconds)}
                </span>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {formatPace(distance, effort.durationSeconds)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { BestEfforts };
