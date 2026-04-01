import type { ActivityHistoryRouterOutputs } from "@/utils/types";
import { Separator } from "@corex/ui/components/separator";
import { Skeleton } from "@corex/ui/components/skeleton";
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
} from "./utils";

type RecentActivity = ActivityHistoryRouterOutputs["recentActivities"][number];

export function ActivityPreview({
  activities,
}: {
  activities: RecentActivity[];
}) {
  if (activities.length === 0) {
    return (
      <div className="border-t border-border/70 pt-4">
        <p className="text-sm font-medium">Recent activities</p>
        <p className="mt-2 text-sm text-muted-foreground">
          No imported activities yet.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/70 border-y border-border/70">
      {activities.map((activity) => {
        const path = toSvgPath(activity.routePreview?.latlngs);

        return (
          <Link
            to="/activity/$activityId"
            params={{ activityId: activity.id }}
            key={activity.id}
          >
            <article className="grid gap-4 py-4 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(0,1fr)_168px] md:items-center">
              <div className="min-w-0 space-y-3">
                <h3 className="text-base font-semibold tracking-tight">
                  {activity.name}
                </h3>
                <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3.5" />
                    {formatActivityDateTime(activity.startDate)}
                  </span>

                  <Separator orientation="vertical" className="h-3.5" />

                  <span className="flex items-center gap-1">
                    <FootprintsIcon className="size-3.5" />
                    {formatDistance(activity.distance)}
                  </span>

                  <span className="flex items-center gap-1">
                    <TimerIcon className="size-3.5" />
                    {formatDuration(activity.elapsedTime)}
                  </span>

                  <Separator orientation="vertical" className="h-3.5" />

                  <span className="flex items-center gap-1">
                    <HeartPulseIcon className="size-3.5" />
                    {formatHeartRate(activity.averageHeartrate)}
                  </span>
                </div>
              </div>

              <div className="h-20 overflow-hidden rounded-2xl bg-muted/30 md:w-42">
                {path ? (
                  <svg
                    viewBox="0 0 320 88"
                    className="h-20 w-full"
                    role="img"
                    aria-label={`Map preview for ${activity.name}`}
                  >
                    <path
                      d={path}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-primary"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
                    Map unavailable
                  </div>
                )}
              </div>
            </article>
          </Link>
        );
      })}
    </div>
  );
}

export function ActivityPreviewSkeleton() {
  return (
    <div className="divide-y divide-border/70 border-y border-border/70">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={`activity-preview-skeleton-${index}`} className="py-4">
          <Skeleton className="h-21 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
