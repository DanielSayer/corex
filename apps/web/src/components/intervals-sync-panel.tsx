import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";
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
    <Card className="rounded-4xl border border-border/70 bg-card/60 shadow-none">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>{title}</CardTitle>
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
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Runs processed
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">
                {getTotalImportedCount(syncSummary)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {syncSummary.insertedCount} new, {syncSummary.updatedCount}{" "}
                updated
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Date coverage
              </div>
              <div className="mt-2 text-base font-semibold tracking-tight">
                {formatDateRange(syncSummary.coveredDateRange)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatHistoryCoverage(syncSummary.historyCoverage)}
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Partial items
              </div>
              <div className="mt-2 text-base font-semibold tracking-tight">
                {getPartialItemCount(syncSummary)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {syncSummary.skippedNonRunningCount} unsupported,{" "}
                {syncSummary.skippedInvalidCount} invalid,{" "}
                {syncSummary.failedDetailCount +
                  syncSummary.failedMapCount +
                  syncSummary.failedStreamCount}{" "}
                fetch issues
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/70 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Last completed
              </div>
              <div className="mt-2 text-base font-semibold tracking-tight">
                {formatCompletedAt(syncSummary.completedAt)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
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
      </CardContent>
    </Card>
  );
}
