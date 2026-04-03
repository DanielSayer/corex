import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Separator } from "@corex/ui/components/separator";
import { Skeleton } from "@corex/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { AlertCircleIcon, ArrowRightIcon, TargetIcon } from "lucide-react";

import type { GoalProgressRouterOutputs } from "@/utils/types";

type GoalProgress = GoalProgressRouterOutputs["get"];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateRange(start: string, end: string) {
  return `${formatDate(start)} to ${formatDate(end)}`;
}

function formatDuration(seconds: number) {
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}m`;
}

function formatDistanceMeters(value: number) {
  return `${(value / 1000).toFixed(1)} km`;
}

function formatGoalHeadline(progress: GoalProgress) {
  if (!progress.goal) {
    return "Set a goal to start tracking progress";
  }

  if (progress.goal.type === "event_goal") {
    return progress.goal.eventName?.trim() || "Event goal";
  }

  return `${progress.goal.period === "week" ? "Weekly" : "Monthly"} ${progress.goal.metric} goal`;
}

export function GoalProgressPanel({ progress }: { progress: GoalProgress }) {
  return (
    <section className="flex flex-col gap-6 border-b border-border/70 pb-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Goal progress
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {formatGoalHeadline(progress)}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {progress.status === "ready"
              ? "Live progress is derived from your saved goal and the imported Intervals history in corex."
              : "This module only renders when the goal and history are trustworthy enough to say something useful."}
          </p>
        </div>
        <Badge variant={progress.status === "ready" ? "secondary" : "outline"}>
          {progress.status === "ready"
            ? "Live"
            : progress.status === "no_goal"
              ? "No goal"
              : progress.status === "missing_history"
                ? "Needs history"
                : "Sync stale"}
        </Badge>
      </div>

      {progress.status === "ready" && progress.volumeProgress ? (
        <ReadyVolumeGoal progress={progress} />
      ) : null}

      {progress.status === "ready" && progress.eventProgress ? (
        <ReadyEventGoal progress={progress} />
      ) : null}

      {progress.status !== "ready" ? (
        <BlockedGoalProgress progress={progress} />
      ) : null}
    </section>
  );
}

function ReadyVolumeGoal({ progress }: { progress: GoalProgress }) {
  const details = progress.volumeProgress!;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 border-y border-border/70 py-6 md:grid-cols-3">
          <MetricBlock
            label="Completed"
            value={`${details.completedValue} ${details.unit}`}
            detail={`${details.targetValue} ${details.unit} target`}
          />
          <MetricBlock
            label="Remaining"
            value={`${details.remainingValue} ${details.unit}`}
            detail={`${details.percentComplete}% complete`}
          />
          <MetricBlock
            label="Active period"
            value={details.period === "week" ? "This week" : "This month"}
            detail={formatDateRange(details.periodStart, details.periodEnd)}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-sm font-medium">Recent trend</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {details.recentPeriods.map((period) => (
              <div
                key={period.periodStart}
                className="rounded-[1.5rem] border border-border/70 px-4 py-4"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {formatDate(period.periodStart)}
                </div>
                <div className="mt-2 text-lg font-semibold tracking-tight">
                  {period.completedValue} {details.unit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AsideCard
        title="Goal settings"
        description="Adjust the target if the current block has changed."
        href="/goals"
        actionLabel="Edit goal"
      />
    </div>
  );
}

function ReadyEventGoal({ progress }: { progress: GoalProgress }) {
  const details = progress.eventProgress!;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 border-y border-border/70 py-6 md:grid-cols-3">
          <MetricBlock
            label="Event date"
            value={formatDate(details.eventDate)}
            detail={`${details.daysRemaining} days remaining`}
          />
          <MetricBlock
            label="Longest recent run"
            value={
              details.longestRecentRun
                ? formatDistanceMeters(details.longestRecentRun.distanceMeters)
                : "No recent run"
            }
            detail={
              details.longestRecentRun
                ? formatDate(details.longestRecentRun.startAt)
                : "Sync more recent training"
            }
          />
          <MetricBlock
            label="Best matching effort"
            value={
              details.bestMatchingEffort
                ? details.bestMatchingEffort.distanceLabel
                : "No effort found"
            }
            detail={
              details.bestMatchingEffort
                ? formatDuration(details.bestMatchingEffort.durationSeconds)
                : "No matching PR yet"
            }
          />
        </div>

        <Alert>
          <TargetIcon />
          <AlertTitle>
            {details.readiness.level === "on_track"
              ? "Readiness looks on track"
              : details.readiness.level === "needs_attention"
                ? "Readiness needs attention"
                : "Readiness is still building"}
          </AlertTitle>
          <AlertDescription>{details.readiness.summary}</AlertDescription>
        </Alert>

        <div className="grid gap-3 md:grid-cols-2">
          {details.readiness.signals.map((signal) => (
            <div
              key={signal.key}
              className="rounded-[1.5rem] border border-border/70 px-4 py-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium">{signal.label}</div>
                <Badge
                  variant={
                    signal.tone === "warning"
                      ? "destructive"
                      : signal.tone === "positive"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {signal.tone === "positive"
                    ? "Good"
                    : signal.tone === "warning"
                      ? "Watch"
                      : "Neutral"}
                </Badge>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {signal.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AsideCard
        title="Weekly load"
        description={`${formatDistanceMeters(details.recentWeeklyLoad.currentWeekDistanceMeters)} this week vs ${formatDistanceMeters(details.recentWeeklyLoad.trailingFourWeekAverageDistanceMeters)} 4-week average.`}
        href="/goals"
        actionLabel="Review goal"
      />
    </div>
  );
}

function BlockedGoalProgress({ progress }: { progress: GoalProgress }) {
  const isNoGoal = progress.status === "no_goal";

  return (
    <Alert>
      <AlertCircleIcon />
      <AlertTitle>
        {isNoGoal
          ? "No active goal yet"
          : progress.status === "missing_history"
            ? "Import history before reading progress"
            : "Your imported history is stale"}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          {isNoGoal
            ? "Set a goal first so the dashboard has something concrete to track."
            : "Progress stays blocked until the imported run history is recent enough to trust."}
        </span>
        <div className="flex flex-wrap gap-3">
          {isNoGoal ? (
            <Link
              to="/goals"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              Create or edit goal <ArrowRightIcon className="size-4" />
            </Link>
          ) : (
            <a
              href="#intervals-sync"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              Sync Intervals history <ArrowRightIcon className="size-4" />
            </a>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

function MetricBlock({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-sm text-muted-foreground">{detail}</div>
    </div>
  );
}

function AsideCard({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: "/goals";
  actionLabel: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border/70 px-5 py-5">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <Separator />
        <Link
          to={href}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          {actionLabel} <ArrowRightIcon className="size-4" />
        </Link>
      </div>
    </div>
  );
}

export function GoalProgressPanelSkeleton() {
  return <Skeleton className="h-70 w-full rounded-[1.75rem]" />;
}
