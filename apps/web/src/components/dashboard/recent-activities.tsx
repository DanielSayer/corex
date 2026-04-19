import { Link } from "@tanstack/react-router";
import {
  ClockIcon,
  FootprintsIcon,
  HeartPulseIcon,
  TimerIcon,
} from "lucide-react";

import {
  formatActivityDateTime,
  formatDistance,
  formatDuration,
  formatHeartRate,
  toSvgPath,
} from "@/components/dashboard/utils";
import type { DashboardRouterOutputs } from "@/utils/types";

type DashboardData = DashboardRouterOutputs["get"];

export function RecentActivities({
  activities,
}: {
  activities: DashboardData["recentActivities"];
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Recent Activities
        </h2>
        <p className="text-base text-muted-foreground">
          A quick look at your 5 most recent activities.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {activities.length > 0 ? (
          activities.map((activity) => {
            const path = toSvgPath(activity.routePreview?.latlngs);

            return (
              <Link
                key={activity.id}
                params={{ activityId: activity.id }}
                to="/activity/$activityId"
              >
                <article className="grid gap-4 rounded-lg border border-border/70 bg-card/70 px-5 py-3 transition-colors hover:border-cyan-400/40 md:grid-cols-[minmax(0,1fr)_196px] md:items-center">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-medium">
                      {activity.name}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="size-4" />
                        {formatActivityDateTime(activity.startDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <TimerIcon className="size-4" />
                        {formatDuration(activity.elapsedTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <HeartPulseIcon className="size-4" />
                        {formatHeartRate(activity.averageHeartrate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FootprintsIcon className="size-4" />
                        {formatDistance(activity.distance)}
                      </span>
                    </div>
                  </div>
                  <div className="h-20 overflow-hidden rounded-lg border border-border/60 bg-background/50">
                    {path ? (
                      <svg
                        aria-label={`Map preview for ${activity.name}`}
                        className="h-full w-full"
                        role="img"
                        viewBox="0 0 320 88"
                      >
                        <path
                          className="stroke-cyan-400"
                          d={path}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                        />
                      </svg>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Map unavailable
                      </div>
                    )}
                  </div>
                </article>
              </Link>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 p-5 text-sm text-muted-foreground">
            No imported activities yet.
          </div>
        )}
      </div>
    </section>
  );
}
