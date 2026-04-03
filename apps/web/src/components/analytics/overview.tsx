import {
  ActivityIcon,
  CalendarRangeIcon,
  RouteIcon,
  TrophyIcon,
} from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@corex/ui/components/select";

import { formatDistanceToKm } from "@/components/activities/utils/formatters";

import type { AnalyticsView } from "./types";
import { SnapshotRow } from "./shared";

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
  return (
    <section className="grid gap-6 pt-2 xl:grid-cols-[minmax(0,1.2fr)_300px]">
      <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-gradient-to-br from-primary/8 via-background to-accent/20 px-6 py-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarRangeIcon className="size-4" />
          Performance analytics
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Yearly distance and PR movement in one view.
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
            Track how your running volume changes by week or month, then inspect
            monthly PR progression for each race distance without leaving the
            main workspace.
          </p>
        </div>
      </div>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Year</CardTitle>
          <CardDescription>
            All charts follow the selected local year in {timezone}.
          </CardDescription>
          <CardAction>
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
              <SelectContent>
                <SelectGroup>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SnapshotRow
            icon={RouteIcon}
            label="Tracked PR distances"
            value={`${analytics?.prTrends.distances.length ?? 0}`}
          />
          <SnapshotRow
            icon={TrophyIcon}
            label="All-time PRs"
            value={`${analytics?.overallPrs.length ?? 0}`}
          />
          <SnapshotRow
            icon={ActivityIcon}
            label="Longest run"
            value={
              analytics?.longestRun
                ? formatDistanceToKm(analytics.longestRun.distanceMeters)
                : "--"
            }
          />
        </CardContent>
      </Card>
    </section>
  );
}
