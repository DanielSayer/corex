import { formatSecondsToMinsPerKm } from "@/components/activities/utils/formatters";
import { FlameIcon, TrophyIcon, ZapIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { WEEKLY_WRAPPED_STAGGER_CHILD } from "./utils";
import type { WeeklyWrappedData } from "./weekly-wrapped";

function HighlightsSlide({ data }: { data: WeeklyWrappedData }) {
  const highlights = data.highlights;
  const items: { icon: ReactNode; label: string; value: string }[] = [];

  if (highlights?.longestRunMeters) {
    items.push({
      icon: <TrophyIcon className="size-5 text-amber-400" />,
      label: "Longest Run",
      value: `${(highlights.longestRunMeters / 1000).toFixed(1)} km`,
    });
  }

  if (highlights?.fastestRunPaceSecPerKm) {
    items.push({
      icon: <ZapIcon className="size-5 text-purple-400" />,
      label: "Fastest Pace",
      value: formatSecondsToMinsPerKm(highlights.fastestRunPaceSecPerKm),
    });
  }

  if (highlights?.bestDistanceDayMeters) {
    items.push({
      icon: <FlameIcon className="size-5 text-orange-400" />,
      label: "Best Distance Day",
      value: `${(highlights.bestDistanceDayMeters / 1000).toFixed(1)} km`,
    });
  }

  return (
    <motion.div
      className="flex flex-col items-center gap-6 py-4 text-center"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.15 } },
      }}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={WEEKLY_WRAPPED_STAGGER_CHILD}>
        <TrophyIcon className="mx-auto mb-1 size-9 text-amber-400" />
        <p className="text-card-foreground text-lg font-bold">Highlights</p>
      </motion.div>
      <div className="grid w-full gap-3">
        {items.map((item, index) => (
          <motion.div
            key={item.label}
            className="flex items-center gap-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.12 }}
          >
            {item.icon}
            <div className="text-left">
              <p className="text-muted-foreground text-xs">{item.label}</p>
              <p className="text-card-foreground text-lg font-bold">
                {item.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      <motion.p
        className="text-muted-foreground text-sm"
        variants={WEEKLY_WRAPPED_STAGGER_CHILD}
      >
        This review is frozen to preserve what the week looked like at the time.
      </motion.p>
    </motion.div>
  );
}

export { HighlightsSlide };
