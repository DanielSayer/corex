import {
  EMPTY_VALUE,
  formatDistanceToKm,
} from "@/components/activities/utils/formatters";
import { formatCalendarDuration } from "@/components/training-calendar/formatters";
import type { TrainingCalendarRouterOutputs } from "@/utils/types";
import { Button } from "@corex/ui/components/button";
import { Link } from "@tanstack/react-router";
import {
  AlertCircleIcon,
  ArrowRightLeftIcon,
  CheckCircle2Icon,
  LinkIcon,
  RouteIcon,
  TimerIcon,
} from "lucide-react";

type PlannedSession =
  TrainingCalendarRouterOutputs["month"]["plannedSessions"][number];

type PlannedSessionCardProps = {
  session: PlannedSession;
  onLinkActivity: (plannedDate: string, activityId: string) => void;
  isLinking: boolean;
};

function getStatusLabel(session: PlannedSession) {
  if (session.status === "completed") {
    return "Planned and completed";
  }

  if (session.status === "moved") {
    return session.actualLocalDate
      ? `Moved to ${session.actualLocalDate}`
      : "Moved";
  }

  if (session.status === "partial") {
    return "Partial completion";
  }

  if (session.status === "missed") {
    return "Missed";
  }

  return "Planned session";
}

function PlannedSessionCard({
  session,
  onLinkActivity,
  isLinking,
}: PlannedSessionCardProps) {
  const linkedActivity = session.linkedActivity;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-amber-700 uppercase dark:text-amber-400">
            {getStatusLabel(session)}
          </div>
          <div className="truncate text-sm font-semibold text-foreground">
            {session.title}
          </div>
          <div className="text-xs text-muted-foreground">{session.summary}</div>
        </div>
        {session.status === "completed" ? (
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        ) : session.status === "moved" ? (
          <ArrowRightLeftIcon className="mt-0.5 size-4 shrink-0 text-sky-600" />
        ) : session.status === "partial" || session.status === "missed" ? (
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-700" />
        ) : null}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <TimerIcon className="h-3 w-3" />
          {formatCalendarDuration(session.estimatedDurationSeconds)}
        </span>
        <span className="flex items-center gap-1">
          <RouteIcon className="h-3 w-3" />
          {session.estimatedDistanceMeters != null
            ? formatDistanceToKm(session.estimatedDistanceMeters)
            : EMPTY_VALUE}
        </span>
      </div>

      {linkedActivity ? (
        <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-[11px] text-foreground">
          <div className="font-medium">{linkedActivity.name}</div>
          <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
            <span>{formatDistanceToKm(linkedActivity.distance)}</span>
            <span>{formatCalendarDuration(linkedActivity.elapsedTime)}</span>
            <span>
              Load{" "}
              {linkedActivity.trainingLoad != null
                ? Math.round(linkedActivity.trainingLoad)
                : EMPTY_VALUE}
            </span>
          </div>
          <Link
            to="/activity/$activityId"
            params={{ activityId: linkedActivity.id }}
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-300"
          >
            <LinkIcon className="size-3" />
            View activity
          </Link>
        </div>
      ) : session.candidateActivities.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-medium text-muted-foreground">
            Same-week activities
          </div>
          {session.candidateActivities.map((activity) => (
            <Button
              key={activity.id}
              type="button"
              variant="secondary"
              size="sm"
              className="justify-between gap-3 text-xs"
              disabled={isLinking}
              onClick={() => onLinkActivity(session.date, activity.id)}
            >
              <span className="truncate">{activity.name}</span>
              <span className="shrink-0">
                {formatDistanceToKm(activity.distance)}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="text-[10px] text-muted-foreground">
          No same-day activities available to link yet.
        </div>
      )}
    </div>
  );
}

export { PlannedSessionCard };
