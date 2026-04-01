import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import { BackButton } from "../back-button";
import { redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, MapIcon } from "lucide-react";
import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Separator } from "@corex/ui/components/separator";
import { Skeleton } from "@corex/ui/components/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/hover-card";
import { trpc } from "@/utils/trpc";
import { AltitudeChart } from "./altitude-chart";
import { BestEfforts } from "./best-efforts";
import { CadenceChart } from "./cadence-chart";
import { CompareChart } from "./compare-chart";
import { HrChart } from "./hr-chart";
import { HrZoneChart } from "./hr-zone-chart";
import { RadialBarGraph } from "./radial-bar-graph";
import { SplitsChart } from "./splits-chart";
import { SplitsTable } from "./splits-table";
import { StatGroup } from "./stats-group";
import { VelocityChart } from "./velocity-chart";
import {
  EMPTY_VALUE,
  formatDateTime,
  formatDistanceToKm,
  formatSecondsToHms,
  formatSpeedToMinsPerKm,
} from "./utils/formatters";
import type { ActivityMapData, ActivitySummary } from "./utils/types";

const LazyRouteMap = lazy(async () => {
  const module = await import("../route-map");

  return { default: module.RouteMap };
});

type ActivityDetailsProps = {
  activity: ActivitySummary | null;
  activityId: string;
};

function ActivityDetailView({ activity, activityId }: ActivityDetailsProps) {
  if (!activity) {
    throw redirect({ to: "/dashboard" });
  }

  const workIntervals = useMemo(
    () =>
      activity.intervals
        .filter((item) => item.intervalType === "WORK")
        .sort((left, right) => (left.startTime ?? 0) - (right.startTime ?? 0))
        .map((item, index) => ({
          ...item,
          lapNumber: index + 1,
        })),
    [activity.intervals],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <BackButton fallbacks={{ to: "/dashboard" }} />
          <h1 className="text-4xl font-bold tracking-tight">
            {activity.name ?? "Morning Run"}
          </h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <CalendarIcon className="size-4" />
            {formatDateTime(activity.startDateLocal)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {activity.deviceName ? (
            <p className="text-muted-foreground text-sm">
              {activity.deviceName}
            </p>
          ) : null}
          <Badge className="uppercase">{activity.type ?? "Run"}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-4">
          <DeferredRouteMap mapData={activity.mapPreview} />

          <div className="mx-auto grid grid-cols-4 gap-4">
            {activity.hrLoad ? (
              <RadialBarGraph
                value={activity.hrLoad}
                label="HR Load"
                variant={1}
              />
            ) : null}
            {activity.trainingLoad ? (
              <RadialBarGraph
                value={activity.trainingLoad}
                label="Training Load"
                variant={2}
              />
            ) : null}
            {activity.intensity ? (
              <RadialBarGraph
                value={activity.intensity}
                label="Intensity"
                variant={3}
              />
            ) : null}
            {activity.maxHeartrate && activity.athleteMaxHr ? (
              <HoverCard>
                <HoverCardTrigger>
                  <RadialBarGraph
                    value={
                      (activity.maxHeartrate / activity.athleteMaxHr) * 100
                    }
                    label="Max HR"
                    displayValue={activity.maxHeartrate}
                    variant={4}
                  />
                </HoverCardTrigger>
                <HoverCardContent side="right">
                  <p className="mb-0.5 font-bold">Max Heartrate Summary</p>
                  <p>
                    You achieved{" "}
                    {Math.round(
                      (activity.maxHeartrate / activity.athleteMaxHr) * 100,
                    )}
                    % of your max heartrate.
                  </p>
                  <div className="text-muted-foreground">
                    <p>This run max {activity.maxHeartrate} bpm</p>
                    <p>All time max {activity.athleteMaxHr} bpm</p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : null}
          </div>
        </div>

        <div className="border-border bg-card flex flex-col justify-between rounded-xl border p-6">
          <div className="my-auto space-y-6">
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium tracking-widest uppercase">
                Distance
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl leading-none font-black">
                  {formatDistanceToKm(activity.distance, { showUnit: false })}
                </span>
                <span className="text-muted-foreground text-xl font-medium">
                  km
                </span>
              </div>
            </div>

            <Separator />

            <StatGroup
              items={[
                {
                  label: "Time",
                  value: formatSecondsToHms(activity.movingTime),
                },
                {
                  label: "Avg Pace",
                  value: formatSpeedToMinsPerKm(activity.averageSpeed),
                  sub: "/km",
                },
                {
                  label: "Avg HR",
                  value: activity.averageHeartrate
                    ? `${Math.round(activity.averageHeartrate)}`
                    : EMPTY_VALUE,
                  sub: "bpm",
                },
              ]}
            />

            <Separator />

            <StatGroup
              items={[
                {
                  label: "Elevation",
                  value: activity.totalElevationGain
                    ? `${Math.round(activity.totalElevationGain)}m`
                    : EMPTY_VALUE,
                },
                {
                  label: "Cadence",
                  value: activity.averageCadence
                    ? `${Math.round(activity.averageCadence)}`
                    : EMPTY_VALUE,
                  sub: "spm",
                },
                {
                  label: "Calories",
                  value: activity.calories
                    ? `${Math.round(activity.calories)}`
                    : EMPTY_VALUE,
                  sub: "kcal",
                },
              ]}
            />
          </div>

          <Separator className="my-6" />
          <BestEfforts efforts={activity.bestEfforts} />
        </div>
      </div>

      <Separator className="mb-12" />

      <SplitsTable splits={workIntervals} />
      <Separator className="mb-12" />

      <SplitsChart splits={activity.oneKmSplitTimesSeconds ?? []} />

      <Separator className="mb-12" />
      <HrZoneChart
        hrZones={activity.heartRateZonesBpm}
        hrZoneTimes={activity.heartRateZoneDurationsSeconds}
      />

      <Separator className="mb-12" />
      <AdvancedAnalysisSection activity={activity} activityId={activityId} />
      <div className="h-12" />
    </div>
  );
}

function DeferredRouteMap({ mapData }: { mapData: ActivityMapData | null }) {
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (shouldRender) {
      return;
    }

    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={containerRef}>
      {shouldRender ? (
        <Suspense fallback={<RouteMapSkeleton mapData={mapData} />}>
          <LazyRouteMap
            mapData={mapData}
            className="h-[50vh] max-h-128 rounded-xl"
          />
        </Suspense>
      ) : (
        <RouteMapSkeleton mapData={mapData} />
      )}
    </div>
  );
}

function RouteMapSkeleton({ mapData }: { mapData: ActivityMapData | null }) {
  if (!mapData) {
    return (
      <div className="bg-muted/30 text-muted-foreground flex h-[50vh] max-h-128 w-full items-center justify-center rounded-xl border text-xs">
        Route unavailable
      </div>
    );
  }

  return <Skeleton className="h-[50vh] max-h-128 w-full rounded-xl" />;
}

function AdvancedAnalysisSection({
  activity,
  activityId,
}: {
  activity: ActivitySummary;
  activityId: string;
}) {
  const [shouldRenderCharts, setShouldRenderCharts] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.IntersectionObserver === "undefined",
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const analysisQuery = useQuery({
    ...trpc.activityHistory.activityAnalysis.queryOptions({ activityId }),
    enabled: true,
    gcTime: 60_000,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const hasAnalysisData = analysisQuery.data
    ? Object.values(analysisQuery.data).some((series) => series.length > 0)
    : false;

  useEffect(() => {
    if (shouldRenderCharts) {
      return;
    }

    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderCharts(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [shouldRenderCharts]);

  return (
    <section ref={containerRef} className="space-y-6">
      <div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Advanced Analysis
          </h2>
          <p className="text-muted-foreground text-sm">
            Chart-heavy analysis loads automatically and renders when this
            section scrolls into view.
          </p>
        </div>
      </div>

      {!shouldRenderCharts ? (
        <div className="border-border bg-card text-muted-foreground flex items-center gap-3 rounded-xl border p-6 text-sm">
          <MapIcon className="size-4 shrink-0" />
          Heart rate, cadence, pace, elevation, and compare charts are loading
          in the background and will render automatically.
        </div>
      ) : null}

      {shouldRenderCharts && analysisQuery.isLoading ? (
        <AnalysisSkeleton />
      ) : null}

      {shouldRenderCharts && analysisQuery.isError ? (
        <div className="border-destructive/30 bg-card rounded-xl border p-6">
          <p className="text-destructive text-sm">
            Failed to load advanced analysis.
          </p>
          <Button
            className="mt-4"
            onClick={() => analysisQuery.refetch()}
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {shouldRenderCharts && analysisQuery.data && hasAnalysisData ? (
        <div className="space-y-12">
          <CompareChart analysis={analysisQuery.data} />
          <HrChart
            averageHeartrate={activity.averageHeartrate}
            maxHeartrate={activity.maxHeartrate}
            series={analysisQuery.data.heartrate}
          />
          <CadenceChart
            averageCadence={activity.averageCadence}
            series={analysisQuery.data.cadence}
          />
          <VelocityChart
            averageSpeed={activity.averageSpeed}
            maxSpeed={activity.maxSpeed}
            series={analysisQuery.data.velocity_smooth}
          />
          <AltitudeChart
            totalElevationGain={activity.totalElevationGain}
            totalElevationLoss={activity.totalElevationLoss}
            series={analysisQuery.data.fixed_altitude}
          />
        </div>
      ) : null}

      {shouldRenderCharts && analysisQuery.data && !hasAnalysisData ? (
        <div className="border-border bg-card text-muted-foreground rounded-xl border p-6 text-sm">
          No advanced stream analysis is available for this activity yet.
        </div>
      ) : null}
    </section>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-12">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-[25vh] max-h-64 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export { ActivityDetailView };
