import type { IntervalsSyncRouterOutputs } from "@/utils/types";
import {
  formatDistanceToKm,
  formatSecondsToMinsPerKm,
  EMPTY_VALUE,
} from "@/components/activities/utils/formatters";
import { Link } from "@tanstack/react-router";
import { ActivityIcon, TimerIcon } from "lucide-react";

import { formatCalendarDuration } from "./formatters";

type WorkoutCardProps = {
  workout: IntervalsSyncRouterOutputs["calendar"]["activities"][number];
};

function WorkoutCard({ workout }: WorkoutCardProps) {
  return (
    <Link to="/activity/$activityId" params={{ activityId: workout.id }}>
      <div className="group relative flex cursor-pointer flex-col gap-1 overflow-hidden rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2.5 transition-all hover:border-cyan-500/40 hover:bg-cyan-500/15">
        {/* Accent left border indicator */}
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-cyan-500/50 transition-colors group-hover:bg-cyan-500" />

        <div className="flex flex-col text-xs font-semibold text-cyan-700 dark:text-cyan-400">
          <span className="text-end">
            {formatDistanceToKm(workout.distance)}
          </span>
          <span className="truncate">{workout.name}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-[10px] font-medium text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1">
            <TimerIcon className="h-3 w-3 opacity-70" />
            {formatCalendarDuration(workout.elapsedTime)}
          </div>
          <div className="flex items-center gap-1">
            <ActivityIcon className="h-3 w-3 opacity-70" />
            {workout.averageHeartrate != null
              ? `${Math.round(workout.averageHeartrate)} bpm`
              : EMPTY_VALUE}
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between border-t border-cyan-500/10 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span>
            Pace:{" "}
            {formatSecondsToMinsPerKm(workout.averagePaceSecondsPerKm, {
              showUnit: true,
            })}
          </span>
          <span>
            Load:{" "}
            {workout.trainingLoad != null
              ? Math.round(workout.trainingLoad)
              : EMPTY_VALUE}
          </span>
        </div>
      </div>
    </Link>
  );
}

export { WorkoutCard };
