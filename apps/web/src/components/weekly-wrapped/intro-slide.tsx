import {
  formatPace,
  formatSecondsToHms,
} from "@/components/activities/utils/formatters";
import { Separator } from "@corex/ui/components/separator";
import { FlameIcon } from "lucide-react";
import { motion } from "motion/react";

import { AnimatedNumber } from "../animated-number";
import { DeltaBadge } from "./delta-badge";
import { formatWeekRange, WEEKLY_WRAPPED_STAGGER_CHILD } from "./utils";
import type { WeeklyWrappedData } from "./weekly-wrapped";

function IntroSlide({ data }: { data: WeeklyWrappedData }) {
  const distKm = data.totals ? data.totals.distanceMeters / 1000 : 0;

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-6 py-4 text-center"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.15 } } }}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={WEEKLY_WRAPPED_STAGGER_CHILD}>
        <FlameIcon className="mx-auto size-10 text-teal-400" />
      </motion.div>
      <motion.div variants={WEEKLY_WRAPPED_STAGGER_CHILD}>
        <p className="text-sm font-medium tracking-widest text-teal-400 uppercase">
          Weekly Review
        </p>
        {data.period ? (
          <p className="text-muted-foreground mt-1 text-xs">
            {formatWeekRange(
              data.period.weekStart,
              data.period.weekEnd,
              data.period.timezone,
            )}
          </p>
        ) : null}
      </motion.div>
      <motion.div variants={WEEKLY_WRAPPED_STAGGER_CHILD} className="space-y-1">
        <div className="text-card-foreground text-6xl font-black tracking-tight">
          <AnimatedNumber value={distKm} decimals={1} />
          <span className="text-muted-foreground ml-2 text-2xl font-medium">
            km
          </span>
        </div>
        <p className="text-muted-foreground text-sm">total distance</p>
      </motion.div>
      <motion.div
        variants={WEEKLY_WRAPPED_STAGGER_CHILD}
        className="flex items-center gap-6 text-center"
      >
        <div>
          <p className="text-card-foreground text-3xl font-bold">
            <AnimatedNumber value={data.totals?.runCount ?? 0} />
          </p>
          <p className="text-muted-foreground text-xs">
            {(data.totals?.runCount ?? 0) === 1 ? "run" : "runs"}
          </p>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div>
          <p className="text-card-foreground text-3xl font-bold">
            {data.totals
              ? formatSecondsToHms(data.totals.elapsedTimeSeconds)
              : "—"}
          </p>
          <p className="text-xs text-zinc-500">total time</p>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div>
          <p className="text-card-foreground text-3xl font-bold">
            {data.totals?.avgPaceSecPerKm
              ? formatPace(1000, data.totals.avgPaceSecPerKm, {
                  showUnit: false,
                })
              : "—"}
          </p>
          <p className="text-xs text-zinc-500">/km avg</p>
        </div>
      </motion.div>
      {data.comparisonVsPriorWeek ? (
        <motion.div
          variants={WEEKLY_WRAPPED_STAGGER_CHILD}
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        >
          <DeltaBadge
            value={data.comparisonVsPriorWeek.distanceMetersDelta}
            unit="km"
          />
          <DeltaBadge
            value={data.comparisonVsPriorWeek.runCountDelta}
            unit={
              Math.abs(data.comparisonVsPriorWeek.runCountDelta) === 1
                ? "run"
                : "runs"
            }
          />
          {data.comparisonVsPriorWeek.avgPaceSecPerKmDelta !== null ? (
            <DeltaBadge
              value={data.comparisonVsPriorWeek.avgPaceSecPerKmDelta}
              unit="/km"
              invert
            />
          ) : null}
        </motion.div>
      ) : null}
    </motion.div>
  );
}

export { IntroSlide };
