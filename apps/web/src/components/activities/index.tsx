import { BackButton } from "../back-button";
import { RouteMap } from "../route-map";
import { redirect } from "@tanstack/react-router";
import { CalendarIcon } from "lucide-react";
import { Badge } from "@corex/ui/components/badge";
import { Separator } from "@corex/ui/components/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/hover-card";
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
import type { ActivityDetails } from "./utils/types";

type ActivityDetailsProps = {
  activity: ActivityDetails | null;
};

function ActivityDetailView({ activity }: ActivityDetailsProps) {
  if (!activity) {
    throw redirect({ to: "/dashboard" });
  }

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
          {activity.deviceName && (
            <p className="text-muted-foreground text-sm">
              {activity.deviceName}
            </p>
          )}
          <Badge className="uppercase">{activity.type ?? "Run"}</Badge>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2">
          <RouteMap
            mapData={activity.mapData}
            className="h-[50vh] max-h-128 rounded-xl"
          />

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

      <SplitsTable
        splits={activity.intervals
          .filter((item) => item.intervalType === "WORK")
          .sort((left, right) => (left.startTime ?? 0) - (right.startTime ?? 0))
          .map((item, index) => ({
            ...item,
            lapNumber: index + 1,
          }))}
      />
      <Separator className="mb-12" />

      <SplitsChart splits={activity.oneKmSplitTimesSeconds ?? []} />

      <Separator className="mb-12" />
      <HrZoneChart
        hrZones={activity.heartRateZonesBpm}
        hrZoneTimes={activity.heartRateZoneDurationsSeconds}
      />

      <Separator className="mb-12" />
      <CompareChart activity={activity} />

      <Separator className="mb-12" />
      <HrChart activity={activity} />

      <Separator className="mb-12" />
      <CadenceChart activity={activity} />

      <Separator className="mb-12" />
      <VelocityChart activity={activity} />

      <Separator className="mb-12" />
      <AltitudeChart activity={activity} />
      <div className="h-12" />
    </div>
  );
}

export { ActivityDetailView };
