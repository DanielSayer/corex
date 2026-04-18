import { cn } from "@corex/ui/lib/utils";
import { ActivityIcon, AlarmClockCheckIcon } from "lucide-react";

import { formatDistanceKm, formatDuration } from "@/components/dashboard/utils";
import type { DashboardRouterOutputs } from "@/utils/types";

type DashboardData = DashboardRouterOutputs["get"];

export function TodayCard({ today }: { today: DashboardData["today"] }) {
  return (
    <article
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-border/60 p-8 text-center shadow-[0_20px_45px_-34px_rgba(0,0,0,0.95)]",
        today.state === "rest"
          ? "bg-[#10434d]/70"
          : "bg-linear-to-br from-cyan-950/40 to-card",
      )}
    >
      <div className="mb-4 rounded-xl bg-background/70 p-2.5 text-muted-foreground">
        {today.state === "rest" ? <AlarmClockCheckIcon /> : <ActivityIcon />}
      </div>
      <h2 className="text-sm font-medium tracking-tight">{today.title}</h2>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        {today.subtitle}
      </p>
      {today.state === "planned" ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          <span>
            {today.estimatedDistanceMeters != null
              ? `${formatDistanceKm(today.estimatedDistanceMeters)} km`
              : "Distance TBD"}
          </span>
          <span>
            {today.estimatedDurationSeconds != null
              ? formatDuration(today.estimatedDurationSeconds)
              : "Duration TBD"}
          </span>
        </div>
      ) : null}
    </article>
  );
}
