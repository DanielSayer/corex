import type { IntervalsSyncRouterOutputs } from "@/utils/types";
import {
  EMPTY_VALUE,
  formatDistanceToKm,
  formatSecondsToMinsPerKm,
} from "@/components/activities/utils/formatters";
import { MountainIcon, RouteIcon, TimerIcon } from "lucide-react";

import { formatCalendarDuration } from "./formatters";

type WeekSummaryCellProps = {
  weekNum: number;
  summary?: IntervalsSyncRouterOutputs["calendar"]["weeks"][number];
};

function WeekSummaryCell({ weekNum, summary }: WeekSummaryCellProps) {
  if (!summary) {
    return (
      <div className="border-border/50 flex min-h-35 flex-col justify-center border-r bg-slate-50/50 p-4 dark:bg-slate-900/50">
        <p className="text-muted-foreground text-center text-xs font-medium">
          Week {weekNum}
        </p>
      </div>
    );
  }

  return (
    <div className="border-border/50 flex flex-col gap-3 border-r bg-slate-50/50 p-3 dark:bg-slate-900/50">
      <div className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold">
          W{weekNum}
        </div>
        <span className="text-foreground text-xs font-semibold">Summary</span>
      </div>

      <div className="flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <TimerIcon className="h-3.5 w-3.5" />
            <span>Time</span>
          </div>
          <span className="text-foreground font-medium">
            {formatCalendarDuration(summary.time)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <RouteIcon className="h-3.5 w-3.5" />
            <span>Dist</span>
          </div>
          <span className="text-foreground font-medium">
            {formatDistanceToKm(summary.distance)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <MountainIcon className="h-3.5 w-3.5" />
            <span>Elev</span>
          </div>
          <span className="text-foreground font-medium">
            {summary.totalElevationGain > 0
              ? `${summary.totalElevationGain.toFixed(2)}m`
              : EMPTY_VALUE}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <TimerIcon className="h-3.5 w-3.5" />
            <span>Pace</span>
          </div>
          <span className="text-foreground font-medium">
            {formatSecondsToMinsPerKm(summary.averagePaceSecondsPerKm)}
          </span>
        </div>
      </div>
    </div>
  );
}

export { WeekSummaryCell };
