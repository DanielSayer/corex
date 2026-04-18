import { Button } from "@corex/ui/components/button";
import { cn } from "@corex/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { GoalsPanel } from "@/components/dashboard/goals-panel";
import { RecentActivities } from "@/components/dashboard/recent-activities";
import { TodayCard } from "@/components/dashboard/today-card";
import {
  formatDistanceKm,
  formatPace,
  formatSignedDistanceDelta,
  formatSignedPaceDelta,
  formatWeekRange,
} from "@/components/dashboard/utils";
import { WeeklyMetricCard } from "@/components/dashboard/weekly-metric-card";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { queryClient, trpc } from "@/utils/trpc";
import type { DashboardRouterOutputs } from "@/utils/types";

export const Route = createFileRoute("/_app/dashboard")({
  component: RouteComponent,
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
});

type DashboardData = DashboardRouterOutputs["get"];

function formatSyncTimestamp(sync: DashboardData["sync"]) {
  if (!sync) {
    return "No sync history yet";
  }

  const value = sync.lastCompletedAt ?? sync.lastAttemptedAt;
  const label = sync.lastCompletedAt ? "Last synced" : "Last attempted";

  return `${label}: ${new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

function greetingForTimezone(timezone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timezone,
    }).format(new Date()),
  );

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const dashboardQueryOptions = trpc.dashboard.get.queryOptions();
  const dashboard = useQuery(dashboardQueryOptions);
  const triggerSync = useMutation({
    ...trpc.intervalsSync.trigger.mutationOptions(),
    onSuccess: (summary) => {
      queryClient.setQueryData(
        dashboardQueryOptions.queryKey,
        (current: DashboardData | undefined) =>
          current
            ? {
                ...current,
                sync: summary,
              }
            : current,
      );
      void queryClient.invalidateQueries({
        queryKey: dashboardQueryOptions.queryKey,
      });
      toast.success(`Sync complete: ${summary.runsProcessed} runs processed`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const data = dashboard.data;

  if (dashboard.isLoading || !data) {
    return <DashboardSkeleton />;
  }

  const timezone = data.timezone;
  const greeting = greetingForTimezone(timezone);
  const syncLabel = formatSyncTimestamp(data.sync);
  const weekRange = formatWeekRange(
    data.weekly.weekToDate.startDate,
    data.weekly.weekToDate.endDate,
  );

  return (
    <main className="mx-auto w-full max-w-7xl space-y-3 px-4 py-4">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {greeting}, {session.data?.user.name}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{triggerSync.isPending ? "Syncing..." : syncLabel}</span>
          <Button
            aria-label="Sync Intervals"
            disabled={triggerSync.isPending}
            onClick={() => void triggerSync.mutateAsync()}
            size="icon"
            variant="outline"
          >
            <RefreshCwIcon
              className={cn("size-4", triggerSync.isPending && "animate-spin")}
            />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-x-4 gap-y-8 md:grid-cols-2">
        <TodayCard today={data.today} />

        <div className="flex flex-col gap-2">
          <WeeklyMetricCard
            averageLabel={`${formatDistanceKm(data.weekly.distance.avgWeekMeters)} km`}
            currentValue={formatDistanceKm(data.weekly.distance.thisWeekMeters)}
            deltaLabel={formatSignedDistanceDelta(
              data.weekly.distance.vsLastWeekMeters,
            )}
            deltaPositive={data.weekly.distance.vsLastWeekMeters >= 0}
            metric="distance"
            rangeLabel={weekRange}
            series={data.weekly.distance.series}
            unit="km"
          />
          <WeeklyMetricCard
            averageLabel={formatPace(data.weekly.pace.avgWeekSecPerKm)}
            currentValue={formatPace(data.weekly.pace.thisWeekSecPerKm, {
              showUnit: false,
            })}
            deltaLabel={formatSignedPaceDelta(
              data.weekly.pace.vsLastWeekSecPerKm,
            )}
            deltaPositive={(data.weekly.pace.vsLastWeekSecPerKm ?? 0) <= 0}
            metric="pace"
            rangeLabel={weekRange}
            series={data.weekly.pace.series}
            unit="/km"
          />
        </div>

        <GoalsPanel goals={data.goals} />

        <RecentActivities activities={data.recentActivities} />
      </div>
    </main>
  );
}
