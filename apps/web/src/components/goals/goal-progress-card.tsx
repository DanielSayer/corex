import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@corex/ui/components/dropdown-menu";
import { cn } from "@corex/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  Flag,
  Gauge,
  MoreHorizontal,
  Pencil,
  Route,
  Timer,
} from "lucide-react";

import type { GoalProgressRouterOutputs } from "@/utils/types";

import {
  formatGoalStatusText,
  formatGoalSubtext,
  formatRemainingLabel,
  formatProgressPercent,
  getCurrentValue,
  getGoalLabel,
  getProgressPercent,
  getSignalSummary,
  getTargetValue,
  getUnitLabel,
} from "./goal-progress-presenter";

type GoalCard = GoalProgressRouterOutputs["get"]["activeGoals"][number];
type CompletedGoalCard =
  GoalProgressRouterOutputs["get"]["completedGoals"][number];

const accentByType = {
  volume_goal: {
    text: "text-emerald-400",
    barFilled: "bg-emerald-400",
    barPartial: "bg-emerald-400/30",
    icon: Route,
  },
  event_goal: {
    text: "text-sky-400",
    barFilled: "bg-sky-400",
    barPartial: "bg-sky-400/30",
    icon: Flag,
  },
} as const;

export function GoalProgressCard({
  card,
  onEdit,
}: {
  card: GoalCard | CompletedGoalCard;
  onEdit?: () => void;
}) {
  const accent = accentByType[card.goalType];
  const Icon = accent.icon;
  const progress = getProgressPercent(card);
  const secondaryIcon =
    card.goalType === "event_goal"
      ? Gauge
      : card.goal.metric === "time"
        ? Timer
        : Route;
  const SecondaryIcon = secondaryIcon;
  const signalSummary = getSignalSummary(card);

  return (
    <article className="group relative overflow-hidden rounded-[1.35rem] border border-border/60 bg-card/95 p-0 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.7)] transition-colors hover:border-foreground/12">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />

      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2.5">
          <Icon className={cn("h-4 w-4", accent.text)} />
          <span
            className={cn("text-sm font-semibold tracking-wide", accent.text)}
          >
            {getGoalLabel(card)}
          </span>
          <Badge variant="secondary" className="uppercase">
            {formatGoalStatusText(card)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase tabular-nums">
            {card.status === "completed"
              ? "Final state"
              : formatGoalStatusText(card)}
          </span>
          {onEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="bg-card">
                <DropdownMenuItem className="text-xs" onClick={onEdit}>
                  <Pencil className="mr-2 h-3 w-3" />
                  Edit goal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Current
            </p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-5xl leading-none font-bold tracking-tight tabular-nums",
                  accent.text,
                )}
              >
                {getCurrentValue(card)}
              </span>
              <span className="pb-0.5 text-sm font-medium text-muted-foreground">
                {getUnitLabel(card)}
              </span>
            </div>
          </div>

          <div className="pb-1.5 text-right">
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              Target
            </p>
            <span className="text-lg font-semibold text-foreground/55 tabular-nums">
              {getTargetValue(card)}
            </span>
          </div>
        </div>

        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {formatGoalSubtext(card)}
        </p>
      </div>

      <div className="space-y-2 px-5 pt-4 pb-2">
        <div className="flex gap-[2px]">
          {Array.from({ length: 20 }).map((_, index) => {
            const segmentProgress = (index + 1) * 5;
            const isFilled = progress >= segmentProgress;
            const isPartial = !isFilled && progress >= segmentProgress - 5;

            return (
              <div
                key={index}
                className={cn(
                  "h-[6px] flex-1 rounded-[1px] transition-all duration-300",
                  {
                    [accent.barFilled]: isFilled,
                    [accent.barPartial]: isPartial,
                    "bg-muted": !isFilled && !isPartial,
                  },
                )}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
            {formatProgressPercent(progress)}% complete
          </span>
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
            {formatRemainingLabel(card)}
          </span>
        </div>
      </div>

      <div className="mx-5 mt-3 border-t border-border/60 py-3">
        {signalSummary && signalSummary.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {signalSummary.map((signal) => (
              <div
                key={signal.key}
                className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2"
              >
                <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                  {signal.label}
                </div>
                <div className="mt-1 text-xs font-medium text-foreground/80">
                  {signal.value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SecondaryIcon className={cn("h-3.5 w-3.5", accent.text)} />
              <span className="text-xs font-medium tracking-wide text-muted-foreground">
                {card.goalType === "event_goal"
                  ? card.progress?.targetDistance
                    ? `${card.progress.targetDistance.value} ${card.progress.targetDistance.unit} target`
                    : "Sync history to score this event"
                  : card.goal.period === "week"
                    ? "Current week in progress"
                    : "Current month in progress"}
              </span>
            </div>
            {card.goalType === "event_goal" && card.progress?.targetDistance ? (
              <span
                className={cn("text-sm font-bold tabular-nums", accent.text)}
              >
                {card.progress.targetDistance.value}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

export function GoalProgressCta() {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-border/70 px-6 py-8">
      <div className="flex flex-col gap-3">
        <div className="text-[1.1rem] font-semibold tracking-tight">
          No active goals on this account
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Add a recurring volume goal or a future event target to give the
          dashboard something concrete to show.
        </p>
        <div>
          <Button render={<Link to="/goals">Create goal</Link>} />
        </div>
      </div>
    </div>
  );
}
