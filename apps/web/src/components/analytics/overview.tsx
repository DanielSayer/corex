import {
  ActivityIcon,
  CalendarCheck2Icon,
  GaugeIcon,
  SparklesIcon,
  TrophyIcon,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@corex/ui/components/select";

import { formatDistanceToKm } from "@/components/activities/utils/formatters";
import { cn } from "@/lib/utils";

import type { AnalyticsView } from "./types";

export function AnalyticsOverview({
  analytics,
  availableYears,
  selectedYear,
  timezone,
  onYearChange,
}: {
  analytics: AnalyticsView | undefined;
  availableYears: number[];
  selectedYear: number;
  timezone: string;
  onYearChange: (year: number) => void;
}) {
  const overview = analytics?.overview;
  const totalDistance = overview?.totalDistance;
  const longestRun = overview?.longestRunInYear;
  const newPrsThisYear =
    analytics?.overallPrs.filter((pr) =>
      pr.achievedAt.startsWith(`${selectedYear}-`),
    ).length ?? 0;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
            Track your volume, consistency, and personal records across the
            year.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-start">
          <Select
            value={String(selectedYear)}
            onValueChange={(value) => {
              if (value) {
                onYearChange(Number(value));
              }
            }}
          >
            <SelectTrigger className="min-w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                {availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={GaugeIcon}
          label={`Total distance${
            totalDistance?.isPartialYear ? " (YTD)" : ""
          }`}
          value={formatDistanceToKm(totalDistance?.distanceMeters ?? null)}
          detail={formatDeltaDetail(totalDistance)}
          accent="from-[#3b82f6] to-[#5b5df0]"
          detailTone={
            totalDistance?.deltaPercent != null &&
            totalDistance.deltaPercent >= 0
              ? "positive"
              : "neutral"
          }
        />
        <MetricCard
          icon={ActivityIcon}
          label="Longest run"
          value={
            longestRun
              ? formatDistanceToKm(longestRun.distanceMeters)
              : formatDistanceToKm(null)
          }
          detail={
            longestRun
              ? formatLocalDate(longestRun.startAt, timezone)
              : "No long run recorded"
          }
          accent="from-[#7c3aed] to-[#4f46e5]"
        />
        <MetricCard
          icon={TrophyIcon}
          label="Tracked PR distances"
          value={`${overview?.trackedPrDistanceCount ?? 0}`}
          detail={`Across ${overview?.trackedPrDistanceCount ?? 0} distances`}
          accent="from-[#2563eb] to-[#1d4ed8]"
        />
        <MetricCard
          icon={SparklesIcon}
          label="All-time PRs"
          value={`${overview?.allTimePrCount ?? 0}`}
          detail={`${newPrsThisYear} new PR${newPrsThisYear === 1 ? "" : "s"} this year`}
          accent="from-[#7c3aed] to-[#4338ca]"
        />
        <MetricCard
          icon={CalendarCheck2Icon}
          label="Active months"
          value={`${overview?.activeMonths.count ?? 0}`}
          detail={overview?.activeMonths.rangeLabel ?? "No activity yet"}
          accent="from-[#4f46e5] to-[#2563eb]"
        />
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
  detailTone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  accent: string;
  detailTone?: "default" | "positive" | "neutral";
}) {
  return (
    <article className="rounded-[18px] border border-white/8 bg-[#0d1320] p-5 text-white shadow-none">
      <div
        className={cn(
          "mb-5 flex size-14 items-center justify-center rounded-full bg-linear-to-br text-white",
          accent,
        )}
      >
        <Icon className="size-6" />
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="text-sm text-[#8f97b7]">{label}</div>
          <div className="text-[2.05rem] font-semibold tracking-[-0.04em] text-white">
            {value}
          </div>
        </div>
        <div
          className={cn(
            "text-sm",
            detailTone === "positive" && "font-medium text-emerald-400",
            detailTone === "neutral" && "text-[#a8b0cc]",
            detailTone === "default" && "text-[#a8b0cc]",
          )}
        >
          {detail}
        </div>
      </div>
    </article>
  );
}

function formatDeltaDetail(
  totalDistance: AnalyticsView["overview"]["totalDistance"] | undefined,
) {
  if (!totalDistance) {
    return "No comparison year available";
  }

  if (totalDistance.deltaPercent == null) {
    return `No comparison data for ${totalDistance.comparisonYear}`;
  }

  const roundedDelta = Math.round(totalDistance.deltaPercent);
  const prefix = roundedDelta > 0 ? "+" : "";

  return `${prefix}${roundedDelta}% vs ${totalDistance.comparisonYear}`;
}

function formatLocalDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}
