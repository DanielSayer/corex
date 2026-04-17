import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Skeleton } from "@corex/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  FlameIcon,
  HistoryIcon,
} from "lucide-react";
import { useState } from "react";

import { SettingsPageShell } from "@/components/onboarding/settings-page-shell";
import { LoadingWrapper } from "@/components/renderers";
import {
  WeeklyWrapped,
  type WeeklyWrappedSnapshot,
} from "@/components/weekly-wrapped/weekly-wrapped";
import {
  formatGeneratedAt,
  formatWeekRange,
} from "@/components/weekly-wrapped/utils";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { trpc } from "@/utils/trpc";
import type { WeeklySnapshotsRouterOutputs } from "@/utils/types";

type WeeklyWrappedSearch = {
  weekStart?: string;
  weekEnd?: string;
  timezone?: string;
};

type WeeklySnapshotSummary = WeeklySnapshotsRouterOutputs["list"][number];

export const Route = createFileRoute("/_app/weekly-wrapped")({
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
  validateSearch: (search): WeeklyWrappedSearch => ({
    weekStart: readSearchValue(search.weekStart),
    weekEnd: readSearchValue(search.weekEnd),
    timezone: readSearchValue(search.timezone),
  }),
  component: RouteComponent,
});

function readSearchValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

function getSnapshotKey(input: {
  weekStart: string;
  weekEnd: string;
  timezone: string;
}) {
  return `${input.weekStart}|${input.weekEnd}|${input.timezone}`;
}

function getSnapshotSelection(snapshot: WeeklyWrappedSnapshot) {
  return {
    weekStart: toIsoString(snapshot.weekStart),
    weekEnd: toIsoString(snapshot.weekEnd),
    timezone: snapshot.timezone,
  };
}

function RouteComponent() {
  const search = Route.useSearch() as WeeklyWrappedSearch;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const history = useQuery(trpc.weeklySnapshots.list.queryOptions());
  const trainingSettings = useQuery(trpc.trainingSettings.get.queryOptions());
  const hasAnySelection = Boolean(
    search.weekStart || search.weekEnd || search.timezone,
  );
  const hasCompleteSelection = Boolean(
    search.weekStart && search.weekEnd && search.timezone,
  );
  const latestSnapshot = useQuery(
    trpc.weeklySnapshots.getLatest.queryOptions(undefined, {
      enabled: !hasAnySelection,
    }),
  );
  const selectedSnapshotQuery = useQuery(
    trpc.weeklySnapshots.getByWeek.queryOptions(
      {
        weekStart: search.weekStart ?? "",
        weekEnd: search.weekEnd ?? "",
        timezone: search.timezone ?? "",
      },
      {
        enabled: hasCompleteSelection,
      },
    ),
  );

  const snapshots = history.data ?? [];
  const selectedSnapshot =
    hasCompleteSelection && selectedSnapshotQuery.data
      ? selectedSnapshotQuery.data
      : !hasAnySelection
        ? latestSnapshot.data
        : null;
  const selectedSnapshotLoading = hasCompleteSelection
    ? selectedSnapshotQuery.isLoading
    : !hasAnySelection
      ? latestSnapshot.isLoading
      : false;
  const hasNoSnapshots = !history.isLoading && snapshots.length === 0;
  const selectedMissing =
    !hasNoSnapshots &&
    hasAnySelection &&
    (!hasCompleteSelection ||
      (!selectedSnapshotQuery.isLoading && !selectedSnapshotQuery.data));
  const currentTimezone = trainingSettings.data?.preferences.timezone;
  const hasTimezoneMismatch = Boolean(
    selectedSnapshot &&
    currentTimezone &&
    selectedSnapshot.timezone !== currentTimezone,
  );
  const selectedKey = selectedSnapshot
    ? getSnapshotKey(getSnapshotSelection(selectedSnapshot))
    : hasCompleteSelection
      ? getSnapshotKey({
          weekStart: search.weekStart ?? "",
          weekEnd: search.weekEnd ?? "",
          timezone: search.timezone ?? "",
        })
      : undefined;

  const navigateToSnapshot = (snapshot: WeeklySnapshotSummary) => {
    void navigate({
      to: "/weekly-wrapped",
      search: {
        weekStart: snapshot.weekStart,
        weekEnd: snapshot.weekEnd,
        timezone: snapshot.timezone,
      },
    });
  };
  const navigateToLatest = () => {
    void navigate({
      to: "/weekly-wrapped",
      search: {},
    });
  };

  return (
    <SettingsPageShell
      eyebrow="Retrospective"
      title="Weekly review"
      description="Revisit frozen weekly reviews from persisted snapshots. Each week stays tied to the timezone used when it was generated."
      aside={
        <WeeklyReviewHistoryRail
          snapshots={snapshots}
          selectedKey={selectedKey}
          isLoading={history.isLoading}
          onSelect={navigateToSnapshot}
          onSelectLatest={navigateToLatest}
        />
      }
    >
      {hasTimezoneMismatch && selectedSnapshot && currentTimezone ? (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Historical timezone</AlertTitle>
          <AlertDescription>
            This review was generated in {selectedSnapshot.timezone}. Your
            current training timezone is {currentTimezone}.
          </AlertDescription>
        </Alert>
      ) : null}

      <LoadingWrapper
        isLoading={history.isLoading || selectedSnapshotLoading}
        fallback={<Skeleton className="h-72 w-full rounded-lg" />}
      >
        {hasNoSnapshots ? (
          <EmptySnapshotState />
        ) : selectedMissing ? (
          <MissingSnapshotState onShowLatest={navigateToLatest} />
        ) : selectedSnapshot ? (
          <SelectedSnapshotSection
            snapshot={selectedSnapshot}
            onOpen={() => setOpen(true)}
          />
        ) : (
          <EmptySnapshotState />
        )}
      </LoadingWrapper>

      {selectedSnapshot ? (
        <WeeklyWrapped
          open={open}
          onOpenChange={setOpen}
          data={selectedSnapshot.payload}
        />
      ) : null}
    </SettingsPageShell>
  );
}

function WeeklyReviewHistoryRail({
  snapshots,
  selectedKey,
  isLoading,
  onSelect,
  onSelectLatest,
}: {
  snapshots: WeeklySnapshotSummary[];
  selectedKey: string | undefined;
  isLoading: boolean;
  onSelect: (snapshot: WeeklySnapshotSummary) => void;
  onSelectLatest: () => void;
}) {
  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border/70 px-5 py-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Review history</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Frozen snapshots are ordered from newest to oldest.
          </p>
        </div>
        <Badge variant="outline">{snapshots.length}</Badge>
      </div>

      {snapshots.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={onSelectLatest}
          >
            Latest review
          </Button>
          <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1">
            {snapshots.map((snapshot) => {
              const key = getSnapshotKey(snapshot);
              const selected = key === selectedKey;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(snapshot)}
                  className={[
                    "rounded-lg border px-3 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border/70 hover:bg-muted/60",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {formatWeekRange(
                          snapshot.weekStart,
                          snapshot.weekEnd,
                          snapshot.timezone,
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Generated {formatGeneratedAt(snapshot.generatedAt)}
                      </div>
                    </div>
                    <Badge variant="secondary">{snapshot.timezone}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{formatDistance(snapshot.totals)}</span>
                    <span>{formatRuns(snapshot.totals)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">
          Weekly review history appears after persisted snapshots are generated.
        </p>
      )}
    </section>
  );
}

function SelectedSnapshotSection({
  snapshot,
  onOpen,
}: {
  snapshot: WeeklyWrappedSnapshot;
  onOpen: () => void;
}) {
  const period = snapshot.payload.period;
  const totals = snapshot.payload.totals;
  const highlights = snapshot.payload.highlights;

  return (
    <section className="grid gap-6 rounded-lg border border-border/70 bg-gradient-to-br from-cyan-500/10 via-transparent to-amber-500/10 px-6 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 text-sm font-medium text-cyan-300">
          <FlameIcon className="size-4" />
          Frozen weekly review
        </div>
        <div className="space-y-2">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">
            {period
              ? formatWeekRange(
                  period.weekStart,
                  period.weekEnd,
                  period.timezone,
                )
              : "Weekly snapshot"}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Generated {formatGeneratedAt(snapshot.payload.generatedAt)} in{" "}
            {snapshot.timezone}. This review stays fixed when live goals or
            imported history change later.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onOpen}>Open weekly wrapped</Button>
          <Button
            variant="outline"
            render={<Link to="/dashboard">Back to dashboard</Link>}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SnapshotMetric label="Distance" value={formatDistance(totals)} />
        <SnapshotMetric label="Runs" value={`${totals?.runCount ?? 0}`} />
        <SnapshotMetric
          label="Goals frozen"
          value={`${snapshot.payload.goals.length}`}
        />
        <SnapshotMetric
          label="Highlight"
          value={
            highlights?.longestRunMeters
              ? `${(highlights.longestRunMeters / 1000).toFixed(1)} km long run`
              : "No highlight recorded"
          }
        />
      </div>
    </section>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 border-l border-border/70 pl-4">
      <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function EmptySnapshotState() {
  return (
    <section className="rounded-lg border border-dashed border-border/70 px-6 py-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HistoryIcon className="size-4" />
          No weekly snapshots yet
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Weekly reviews become available after completed local weeks are saved
          as persisted snapshots. Live goal progress is still available on the
          dashboard.
        </p>
        <div>
          <Button
            variant="outline"
            render={<Link to="/dashboard">Go to dashboard</Link>}
          />
        </div>
      </div>
    </section>
  );
}

function MissingSnapshotState({ onShowLatest }: { onShowLatest: () => void }) {
  return (
    <section className="rounded-lg border border-dashed border-border/70 px-6 py-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarDaysIcon className="size-4" />
          Weekly snapshot not found
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The selected week is not available in your persisted review history.
        </p>
        <div>
          <Button variant="outline" onClick={onShowLatest}>
            Show latest review
          </Button>
        </div>
      </div>
    </section>
  );
}

function formatDistance(totals: WeeklySnapshotSummary["totals"]) {
  return totals ? `${(totals.distanceMeters / 1000).toFixed(1)} km` : "No data";
}

function formatRuns(totals: WeeklySnapshotSummary["totals"]) {
  return totals ? `${totals.runCount} runs` : "No runs";
}
