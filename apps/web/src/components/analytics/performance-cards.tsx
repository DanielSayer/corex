import { RouteIcon } from "lucide-react";

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
