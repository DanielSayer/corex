import { Button } from "@corex/ui/components/button";
import { Skeleton } from "@corex/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FlameIcon, HistoryIcon } from "lucide-react";
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

export const Route = createFileRoute("/_app/weekly-wrapped")({
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
  component: RouteComponent,
});

function RouteComponent() {
  const latestSnapshot = useQuery(
    trpc.weeklySnapshots.getLatest.queryOptions(),
  );
  const [open, setOpen] = useState(false);

  return (
    <SettingsPageShell
      eyebrow="Retrospective"
      title="Weekly wrapped"
      description="This view reads a persisted weekly snapshot instead of live training state. It shows what the week looked like when the snapshot was generated."
      aside={
        <div className="rounded-[1.75rem] border border-border/70 px-5 py-5">
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-medium">Live vs frozen</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The dashboard and goals pages calculate progress from your
                current goals and latest synced history. Weekly wrapped stays
                fixed to the stored snapshot for that week.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Use live surfaces for current status.
              <br />
              Use weekly wrapped for retrospective review.
            </div>
          </div>
        </div>
      }
    >
      <LoadingWrapper
        isLoading={latestSnapshot.isLoading}
        fallback={<Skeleton className="h-72 w-full rounded-[1.75rem]" />}
      >
        {latestSnapshot.data ? (
          <LatestSnapshotSection
            snapshot={latestSnapshot.data}
            onOpen={() => setOpen(true)}
          />
        ) : (
          <EmptySnapshotState />
        )}
      </LoadingWrapper>

      {latestSnapshot.data ? (
        <WeeklyWrapped
          open={open}
          onOpenChange={setOpen}
          data={latestSnapshot.data.payload}
        />
      ) : null}
    </SettingsPageShell>
  );
}

function LatestSnapshotSection({
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
    <section className="grid gap-6 rounded-[2rem] border border-border/70 bg-gradient-to-br from-cyan-500/10 via-transparent to-amber-500/10 px-6 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 text-sm font-medium text-cyan-300">
          <FlameIcon className="size-4" />
          Latest frozen review
        </div>
        <div className="space-y-2">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">
            {period
              ? formatWeekRange(period.weekStart, period.weekEnd)
              : "Latest weekly snapshot"}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Generated {formatGeneratedAt(snapshot.payload.generatedAt)} in{" "}
            {snapshot.timezone}. This review does not shift when live goals or
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
        <SnapshotMetric
          label="Distance"
          value={
            totals ? `${(totals.distanceMeters / 1000).toFixed(1)} km` : "—"
          }
        />
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
    <section className="rounded-[1.75rem] border border-dashed border-border/70 px-6 py-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <HistoryIcon className="size-4" />
          No weekly snapshot yet
        </div>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Weekly wrapped becomes available after a completed local week has been
          captured into a persisted snapshot. Live goal progress is still
          available on the dashboard.
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
