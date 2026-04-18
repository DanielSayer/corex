import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Separator } from "@corex/ui/components/separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircleIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import type { IntervalsSyncRouterOutputs } from "@/utils/types";
import { queryClient, trpc } from "@/utils/trpc";

type SyncStatusSummary = NonNullable<IntervalsSyncRouterOutputs["latest"]>;

function formatSyncStatusLabel(status: SyncStatusSummary["status"]) {
  if (status === "in_progress") {
    return "Syncing";
  }

  if (status === "failure") {
    return "Sync failed";
  }

  return "Sync complete";
}

function formatDateRange(range: SyncStatusSummary["coveredDateRange"]) {
  if (!range.start || !range.end) {
    return "No imported runs yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatRange(new Date(range.start), new Date(range.end));
}

function formatCompletedAt(value: string | null) {
  if (!value) {
    return "Still running";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCoverageLabel(
  historyCoverage: SyncStatusSummary["historyCoverage"],
) {
  if (historyCoverage === "incremental_from_cursor") {
    return "Incremental update";
  }

  if (historyCoverage === "initial_30d_window") {
    return "Initial 30 day import";
  }

  return "No coverage recorded";
}

export function IntervalsSyncPanel({
  title = "Intervals sync",
  description = "The first sync pulls roughly your last 30 days of running history. Later syncs only fetch activity changes since your most recent successful import.",
}: {
  title?: string;
  description?: string;
}) {
  const latestSyncQueryOptions = trpc.intervalsSync.latest.queryOptions();
  const latestSync = useQuery(latestSyncQueryOptions);
  const syncSummary = latestSync.data;

  const triggerSync = useMutation({
    ...trpc.intervalsSync.trigger.mutationOptions(),
    onSuccess: (summary) => {
      queryClient.setQueryData(latestSyncQueryOptions.queryKey, summary);
      toast.success(
        `Intervals sync complete: ${summary.runsProcessed} runs processed`,
      );
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isSyncing =
    triggerSync.isPending || syncSummary?.status === "in_progress";
  const status = syncSummary?.status ?? null;

  return (
    <section
      id="intervals-sync"
      className="flex flex-col gap-6 border-t border-border/70 pt-8"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Intervals
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge
            variant={
              status === "failure"
                ? "destructive"
                : status === "success"
                  ? "secondary"
                  : "outline"
            }
          >
            {status ? formatSyncStatusLabel(status) : "Not started"}
          </Badge>
          <Button
            className="w-fit"
            type="button"
            disabled={isSyncing}
            onClick={() => void triggerSync.mutateAsync()}
          >
            {isSyncing ? (
              <LoaderCircleIcon
                className="animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <RefreshCwIcon data-icon="inline-start" />
            )}
            {isSyncing
              ? "Syncing Intervals history"
              : "Get activities from Intervals"}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-5">
        {isSyncing ? (
          <Alert>
            <LoaderCircleIcon className="animate-spin" />
            <AlertTitle>Sync in progress</AlertTitle>
            <AlertDescription>
              Fetching your recent runs from Intervals. This can take a moment
              on the first import.
            </AlertDescription>
          </Alert>
        ) : null}

        {syncSummary ? (
          <div className="grid gap-x-8 gap-y-6 border-y border-border/70 py-6 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Runs processed
              </div>
              <div className="text-3xl font-semibold tracking-tight">
                {syncSummary.runsProcessed}
              </div>
              <div className="text-sm text-muted-foreground">
                {syncSummary.newRuns} new, {syncSummary.updatedRuns} updated
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Date coverage
              </div>
              <div className="text-base font-semibold tracking-tight">
                {formatDateRange(syncSummary.coveredDateRange)}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatCoverageLabel(syncSummary.historyCoverage)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Sync notes
              </div>
              <div className="text-base font-semibold tracking-tight">
                {syncSummary.unsupportedCount +
                  syncSummary.invalidCount +
                  syncSummary.fetchIssueCount}
              </div>
              <div className="text-sm text-muted-foreground">
                {syncSummary.unsupportedCount} unsupported,{" "}
                {syncSummary.invalidCount} invalid,{" "}
                {syncSummary.fetchIssueCount} fetch issues,{" "}
                {syncSummary.warningCount} warnings
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Last completed
              </div>
              <div className="text-base font-semibold tracking-tight">
                {formatCompletedAt(syncSummary.lastCompletedAt)}
              </div>
              <div className="text-sm text-muted-foreground">
                {status === "failure"
                  ? "Needs another attempt"
                  : "Latest sync result"}
              </div>
            </div>
          </div>
        ) : null}

        {status === "failure" && syncSummary?.failureSummary ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Intervals sync failed</AlertTitle>
            <AlertDescription>{syncSummary.failureSummary}</AlertDescription>
          </Alert>
        ) : null}

        <div>
          <Link to="/history" className="text-sm font-medium text-primary">
            View full sync logs in history
          </Link>
        </div>
      </div>
    </section>
  );
}
