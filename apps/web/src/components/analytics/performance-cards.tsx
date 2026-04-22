import { ArrowRightIcon } from "lucide-react";

import {
  formatDistanceToKm,
  formatSecondsToHms,
} from "@/components/activities/utils/formatters";
import { cn } from "@/lib/utils";

import { EmptyPanel, SectionCard } from "./shared";
import type { AnalyticsView } from "./types";
import { getDistanceConfig } from "./utils";

const trainingMixStyles = {
  easy: {
    label: "Easy",
    accent: "bg-lime-400",
    accentSoft: "bg-lime-400/15",
    text: "text-lime-300",
  },
  long_run: {
    label: "Long run",
    accent: "bg-indigo-400",
    accentSoft: "bg-indigo-400/15",
    text: "text-indigo-300",
  },
  tempo: {
    label: "Tempo",
    accent: "bg-orange-400",
    accentSoft: "bg-orange-400/15",
    text: "text-orange-300",
  },
  intervals: {
    label: "Intervals",
    accent: "bg-violet-400",
    accentSoft: "bg-violet-400/15",
    text: "text-violet-300",
  },
} as const;

export function OverallPrsCard({ data }: { data: AnalyticsView }) {
  return (
    <SectionCard
      title="Overall PRs"
      description="All-time best performances across tracked distances."
      contentClassName="pt-5"
    >
      {data.overallPrs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {data.overallPrs.map((pr) => (
            <OverallPrCard key={pr.distanceMeters} pr={pr} />
          ))}
        </div>
      ) : (
        <EmptyPanel
          title="No overall PRs yet"
          description="Once best efforts are processed, your all-time personal records will appear here."
        />
      )}
    </SectionCard>
  );
}

export function TrainingMixCard({ data }: { data: AnalyticsView }) {
  return (
    <SectionCard
      title="Training mix"
      description="Distance breakdown by run type."
      contentClassName="pt-5"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.trainingMix.buckets.map((bucket) => {
          const styles = trainingMixStyles[bucket.key];

          return (
            <article
              key={bucket.key}
              className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4 text-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className={cn("text-sm font-medium", styles.text)}>
                    {styles.label}
                  </div>
                  <div className="text-2xl font-semibold tracking-[-0.04em]">
                    {formatDistanceToKm(bucket.distanceMeters)}
                  </div>
                </div>
                <div
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium text-white/90",
                    styles.accentSoft,
                  )}
                >
                  {bucket.runCount} run{bucket.runCount === 1 ? "" : "s"}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <div className="h-2 rounded-full bg-white/8">
                  <div
                    className={cn("h-full rounded-full", styles.accent)}
                    style={{ width: `${bucket.sharePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[#8e97b7]">
                  <span>{bucket.sharePercent.toFixed(1)}%</span>
                  <span>{styles.label} volume</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function ConsistencyCard({ data }: { data: AnalyticsView }) {
  const consistency = data.consistency;

  return (
    <SectionCard
      title="Consistency"
      description="How often you're showing up."
      contentClassName="pt-5"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div
            className="relative flex size-32 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#5b5df0 ${consistency.percent}%, rgba(255,255,255,0.08) 0)`,
            }}
          >
            <div className="flex size-[104px] flex-col items-center justify-center rounded-full bg-[#0b1019]">
              <div className="text-4xl font-semibold tracking-[-0.05em] text-white">
                {consistency.percent}%
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-semibold tracking-[-0.04em] text-white">
              {consistency.activeMonthCount} / {consistency.elapsedMonthCount}{" "}
              months
            </div>
            <div className="text-sm text-[#9ba4c4]">with activity</div>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3 md:flex md:flex-wrap md:justify-end">
          {consistency.months.map((month) => (
            <div
              key={month.key}
              className={cn(
                "flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                month.isActive
                  ? "border-[#5b5df0]/80 bg-[#4f46e5] text-white"
                  : month.isElapsed
                    ? "border-white/10 bg-white/[0.03] text-[#7e87a5]"
                    : "border-transparent bg-transparent text-[#5f6886]",
              )}
            >
              {month.label.slice(0, 1)}
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function OverallPrCard({ pr }: { pr: AnalyticsView["overallPrs"][number] }) {
  const config = getDistanceConfig(pr.distanceMeters);

  return (
    <article className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex size-12 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: config.color }}
        >
          {config.short}
        </div>
        <ArrowRightIcon className="size-4 text-[#8c95b4]" />
      </div>

      <div className="mt-5 space-y-2">
        <div className="text-sm text-[#8f97b7]">{config.long}</div>
        <div className="text-4xl font-semibold tracking-[-0.05em] text-white">
          {formatSecondsToHms(pr.durationSeconds)}
        </div>
        <div className="text-sm text-[#9aa2c1]">
          {new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }).format(new Date(pr.achievedAt))}
        </div>
      </div>
    </article>
  );
}
