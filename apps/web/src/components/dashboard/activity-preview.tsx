import type { IntervalsSyncRouterOutputs } from "@/utils/types";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";
import { Separator } from "@corex/ui/components/separator";
import { Skeleton } from "@corex/ui/components/skeleton";
import { ClockIcon, HeartPulseIcon, TimerIcon } from "lucide-react";
import {
  formatActivityDateTime,
  formatDuration,
  formatHeartRate,
  toSvgPath,
} from "./utils";

type RecentActivity = IntervalsSyncRouterOutputs["recentActivities"][number];

export function ActivityPreview({
  activities,
}: {
  activities: RecentActivity[];
}) {
  if (activities.length === 0) {
    return (
      <Card className="rounded-[2rem] border border-border/70 bg-card/60 p-4 shadow-none">
        <p className="text-sm font-medium">Recent activities</p>
        <p className="mt-2 text-sm text-muted-foreground">
          No imported activities yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((activity) => {
        const path = toSvgPath(activity.routePreview?.latlngs);

        return (
          <Card
            key={activity.id}
            className="flex-row items-center justify-between rounded-[1.5rem] border border-border/70 bg-card/60 p-3 shadow-none"
          >
            <CardHeader className="w-2/3 flex-1 px-3">
              <CardTitle>{activity.name}</CardTitle>
              <CardDescription className="flex w-full items-center justify-between gap-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ClockIcon className="size-3.5" />
                  {formatActivityDateTime(activity.startDate)}
                </span>

                <Separator orientation="vertical" className="h-3.5" />

                <span className="flex items-center gap-1">
                  <TimerIcon className="size-3.5" />
                  {formatDuration(activity.elapsedTime)}
                </span>

                <Separator orientation="vertical" className="h-3.5" />

                <span className="flex items-center gap-1">
                  <HeartPulseIcon className="size-3.5" />
                  {formatHeartRate(activity.averageHeartrate)}
                </span>
              </CardDescription>
            </CardHeader>

            <div className="h-20 w-1/3 overflow-hidden rounded-xl border border-border/70 bg-muted/30">
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
          </Card>
        );
      })}
    </div>
  );
}

export function ActivityPreviewSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <Card
          key={`activity-preview-skeleton-${index}`}
          className="rounded-[1.5rem] border border-border/70 bg-card/60 p-3 shadow-none"
        >
          <Skeleton className="h-21 w-full" />
        </Card>
      ))}
    </div>
  );
}
