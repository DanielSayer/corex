import { CompassIcon, MapPinIcon, TargetIcon, TrophyIcon } from "lucide-react";
import { motion } from "motion/react";

import { formatNumericValue } from "./utils";
import type { WeeklyWrappedData } from "./weekly-wrapped";

function GoalsSlide({ data }: { data: WeeklyWrappedData }) {
  const completed = data.goals.filter(
    (goal) => goal.goalStatus === "completed",
  ).length;

  return (
    <motion.div
      className="flex flex-col gap-5 py-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <TargetIcon className="mx-auto mb-2 size-9 text-teal-400" />
        <p className="text-card-foreground text-lg font-bold">Goals</p>
        <p className="text-muted-foreground text-xs">
          {completed}/{data.goals.length} goal snapshots frozen as completed
        </p>
      </motion.div>

      <div className="space-y-4">
        {data.goals.map((goal, index) => (
          <GoalRow key={goal.goalId} goal={goal} index={index} />
        ))}
      </div>
    </motion.div>
  );
}

function GoalRow({
  goal,
  index,
}: {
  goal: WeeklyWrappedData["goals"][number];
  index: number;
}) {
  const icon =
    goal.goalType === "volume_goal" ? (
      <MapPinIcon className="size-4 text-emerald-400" />
    ) : (
      <CompassIcon className="size-4 text-sky-400" />
    );
  const ratio = Math.min(goal.completionRatio ?? 0, 1);

  return (
    <motion.div
      className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 px-4 py-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 + index * 0.12 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-card-foreground text-sm font-medium">
            {goal.title}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
              goal.goalStatus === "completed"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-sky-500/15 text-sky-300"
            }`}
          >
            {goal.goalStatus === "completed" ? "Frozen" : "Active"}
          </span>
          {goal.readinessScore !== null ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300 uppercase">
              <TrophyIcon className="size-3" />
              {goal.readinessScore}
            </span>
          ) : null}
        </div>
        <span className="text-muted-foreground text-xs">
          {formatNumericValue(goal.currentValue, goal.unit)} /{" "}
          {formatNumericValue(goal.targetValue, goal.unit)}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{goal.periodLabel}</span>
        <span>
          {goal.remainingValue == null
            ? "No remaining metric"
            : `${formatNumericValue(goal.remainingValue, goal.unit, {
                compact: true,
              })} left`}
        </span>
      </div>

      {goal.completionRatio !== null ? (
        <div className="h-2.5 overflow-hidden rounded-full bg-background">
          <motion.div
            className={`h-full rounded-full ${
              goal.goalStatus === "completed"
                ? "bg-linear-to-r from-emerald-500 to-teal-400"
                : "bg-linear-to-r from-sky-500 to-cyan-400"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${ratio * 100}%` }}
            transition={{
              duration: 0.8,
              delay: 0.3 + index * 0.12,
              ease: "easeOut",
            }}
          />
        </div>
      ) : null}
    </motion.div>
  );
}

export { GoalsSlide };
