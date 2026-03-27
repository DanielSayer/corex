import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Separator } from "@corex/ui/components/separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { queryClient, trpc } from "@/utils/trpc";

type SyncSummary = {
  status: "in_progress" | "success" | "failure";
  historyCoverage: "initial_30d_window" | "incremental_from_cursor" | null;
  coveredDateRange: {
    start: string | null;
    end: string | null;
  };
  insertedCount: number;
  updatedCount: number;
  skippedNonRunningCount: number;
  skippedInvalidCount: number;
  failedDetailCount: number;
  failedMapCount: number;
  failedStreamCount: number;
  warnings: string[];
  failureMessage: string | null;
  completedAt: string | null;
};

function formatHistoryCoverage(
  historyCoverage: SyncSummary["historyCoverage"],
) {
  if (historyCoverage === "incremental_from_cursor") {
    return "Incremental update";
  }

  if (historyCoverage === "initial_30d_window") {
    return "Initial 30 day import";
  }

  return "Ready for first sync";
}

function formatSyncStatusLabel(status: SyncSummary["status"]) {
  if (status === "in_progress") {
    return "Syncing";
  }

  if (status === "failure") {
    return "Sync failed";
  }

  return "Sync complete";
}

function formatDateRange(range: SyncSummary["coveredDateRange"]) {
  if (!range.start || !range.end) {
    return "No imported runs yet";
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${formatter.format(new Date(range.start))} to ${formatter.format(new Date(range.end))}`;
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

function getTotalImportedCount(summary: SyncSummary) {
  return summary.insertedCount + summary.updatedCount;
}

function getPartialItemCount(summary: SyncSummary) {
  return (
    summary.skippedInvalidCount +
    summary.skippedNonRunningCount +
    summary.failedDetailCount +
    summary.failedMapCount +
    summary.failedStreamCount
  );
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
  const syncSummary = latestSync.data as SyncSummary | null | undefined;

  const triggerSync = useMutation({
    ...trpc.intervalsSync.trigger.mutationOptions(),
    onSuccess: (summary) => {
      queryClient.setQueryData(latestSyncQueryOptions.queryKey, summary);
      toast.success(
        `Intervals sync complete: ${getTotalImportedCount(summary)} runs processed`,
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
    <section className="flex flex-col gap-6 border-t border-border/70 pt-8">
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
              Fetching your recent runs, maps, and streams from Intervals. This
              can take a moment on the first import.
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
                {getTotalImportedCount(syncSummary)}
              </div>
              <div className="text-sm text-muted-foreground">
                {syncSummary.insertedCount} new, {syncSummary.updatedCount}{" "}
                updated
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
                {formatHistoryCoverage(syncSummary.historyCoverage)}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Partial items
              </div>
              <div className="text-base font-semibold tracking-tight">
                {getPartialItemCount(syncSummary)}
              </div>
              <div className="text-sm text-muted-foreground">
                {syncSummary.skippedNonRunningCount} unsupported,{" "}
                {syncSummary.skippedInvalidCount} invalid,{" "}
                {syncSummary.failedDetailCount +
                  syncSummary.failedMapCount +
                  syncSummary.failedStreamCount}{" "}
                fetch issues
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Last completed
              </div>
              <div className="text-base font-semibold tracking-tight">
                {formatCompletedAt(syncSummary.completedAt)}
              </div>
              <div className="text-sm text-muted-foreground">
                {status === "failure"
                  ? "Needs another attempt"
                  : "Latest sync result"}
              </div>
            </div>
          </div>
        ) : null}

        {status === "failure" && syncSummary?.failureMessage ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Intervals sync failed</AlertTitle>
            <AlertDescription>{syncSummary.failureMessage}</AlertDescription>
          </Alert>
        ) : null}

        {syncSummary?.warnings.length ? (
          <Alert>
            <AlertCircleIcon />
            <AlertTitle>Sync notes</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5">
                {syncSummary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </section>
  );
}
