import { MountainIcon, RouteIcon } from "lucide-react";

import { Badge } from "@corex/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";

import {
  formatDateTime,
  formatDistanceToKm,
  formatPace,
  formatSecondsToHms,
} from "@/components/activities/utils/formatters";
import { Medal } from "@/components/medal";

import { EmptyPanel } from "./shared";
import type { AnalyticsView } from "./types";
import { getDistanceConfig } from "./utils";

export function OverallPrsCard({ data }: { data: AnalyticsView }) {
  return (
    <Card className="border border-border/70">
      <CardHeader>
        <CardTitle>Overall PRs</CardTitle>
        <CardDescription>
          All-time best performances across tracked distances.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.overallPrs.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {data.overallPrs.map((pr) => (
              <OverallPrCard key={pr.distanceMeters} pr={pr} />
            ))}
          </div>
        ) : (
          <EmptyPanel
            title="No overall PRs yet"
            description="Once best efforts are processed, your all-time PR medals will appear here."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function LongestRunCard({
  longestRun,
}: {
  longestRun: AnalyticsView["longestRun"];
}) {
  return (
    <Card className="border border-border/70 bg-linear-to-br from-accent/30 via-background to-primary/8">
      <CardHeader>
        <CardTitle>Longest run</CardTitle>
        <CardDescription>
          Your farthest imported run across the current history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {longestRun ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="text-4xl font-semibold tracking-tight">
                  {formatDistanceToKm(longestRun.distanceMeters)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {longestRun.activityName}
                </div>
              </div>
              <RouteIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-4">
              <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
                Recorded
              </div>
              <div className="mt-2 text-sm">
                {formatDateTime(longestRun.startAt)}
              </div>
            </div>
          </div>
        ) : (
          <EmptyPanel
            title="No longest run yet"
            description="Import some running history to populate this summary."
            compact
          />
        )}
      </CardContent>
    </Card>
  );
}

export function TerrainMixCard({ data }: { data: AnalyticsView }) {
  const terrain = data.terrainSummary;
  const hasTerrain = terrain.classifiedRunCount > 0;
  const classLabels = {
    flat: "Flat",
    rolling: "Rolling",
    hilly: "Hilly",
  } as const;

  return (
    <Card className="border border-border/70">
      <CardHeader>
        <CardTitle>Terrain mix</CardTitle>
        <CardDescription>
          Elevation density across imported runs in the selected year.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasTerrain ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="text-3xl font-semibold tracking-tight capitalize">
                  {terrain.dominantClass ?? "Mixed"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {terrain.classifiedRunCount} classified of{" "}
                  {terrain.totalRunCount} runs
                </div>
              </div>
              <MountainIcon className="size-5 text-muted-foreground" />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {terrain.classes.map((entry) => {
                const share =
                  terrain.classifiedDistanceMeters > 0
                    ? (entry.distanceMeters /
                        terrain.classifiedDistanceMeters) *
                      100
                    : 0;

                return (
                  <div
                    className="flex min-h-36 flex-col justify-between rounded-lg border border-border/70 bg-muted/25 px-4 py-4"
                    key={entry.terrainClass}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">
                        {classLabels[entry.terrainClass]}
                      </div>
                      <Badge variant="secondary">{entry.runCount}</Badge>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-2xl font-semibold tracking-tight">
                        {formatDistanceToKm(entry.distanceMeters)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.averageElevationGainMetersPerKm == null
                          ? "--"
                          : `${entry.averageElevationGainMetersPerKm.toFixed(
                              1,
                            )} m/km`}{" "}
                        avg
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {terrain.unclassifiedRunCount > 0 ? (
              <div className="text-sm text-muted-foreground">
                {terrain.unclassifiedRunCount} runs are missing usable elevation
                data.
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyPanel
            title="No terrain mix yet"
            description="Import runs with distance and elevation gain to compare flat, rolling, and hilly training."
          />
        )}
      </CardContent>
    </Card>
  );
}

function OverallPrCard({ pr }: { pr: AnalyticsView["overallPrs"][number] }) {
  const config = getDistanceConfig(pr.distanceMeters);

  return (
    <div className="flex flex-col gap-4 rounded-[1.5rem] border border-border/70 bg-muted/30 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <Medal
          color={config.color}
          glow={config.glow}
          label={config.short}
          ring={config.ring}
        />
        <Badge variant="secondary">{pr.monthKey}</Badge>
      </div>
      <div className="flex flex-col gap-1">
        <div className="font-mono text-2xl font-semibold tabular-nums">
          {formatSecondsToHms(pr.durationSeconds)}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatPace(pr.distanceMeters, pr.durationSeconds)} pace
        </div>
      </div>
    </div>
  );
}
