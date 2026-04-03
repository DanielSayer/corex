import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { Skeleton } from "@corex/ui/components/skeleton";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";

import type { GoalsRouterOutputs } from "@/utils/types";

type GoalItem = GoalsRouterOutputs["get"][number];

export function GoalProgressPanel({ goals }: { goals: GoalItem[] }) {
  const activeGoals = goals.filter((goal) => goal.status === "active");

  return (
    <section className="flex flex-col gap-6 border-b border-border/70 pb-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Active goals
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {activeGoals.length > 0
              ? `${activeGoals.length} goals in play`
              : "No active goals yet"}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            The dashboard now keeps goals lightweight. Manage the full goal
            definitions on the dedicated goals page.
          </p>
        </div>
        <Button
          variant="outline"
          render={<Link to="/goals">Manage goals</Link>}
        />
      </div>

      {activeGoals.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {activeGoals.map((goal) => (
            <GoalSummaryCard key={goal.id} item={goal} />
          ))}
        </div>
      ) : (
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
      )}
    </section>
  );
}

function GoalSummaryCard({ item }: { item: GoalItem }) {
  const summary = getGoalSummary(item);

  return (
    <article className="rounded-[1.75rem] border border-border/70 px-5 py-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold tracking-tight">
            {summary.title}
          </h3>
          <Badge variant="secondary">Active</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{summary.description}</p>
        <div className="grid gap-3 border-t border-border/70 pt-4 text-sm md:grid-cols-2">
          <GoalMeta label="Target" value={summary.target} />
          <GoalMeta label="Schedule" value={summary.schedule} />
        </div>
      </div>
    </article>
  );
}

function GoalMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function getGoalSummary(item: GoalItem) {
  if (item.goal.type === "event_goal") {
    return {
      title: item.goal.eventName?.trim() || "Event goal",
      description: `Race target on ${format(parseISO(item.goal.targetDate), "d MMM yyyy")}`,
      target: `${item.goal.targetDistance.value} ${item.goal.targetDistance.unit}`,
      schedule: format(parseISO(item.goal.targetDate), "EEEE, d MMM"),
    };
  }

  return {
    title: `${item.goal.period === "week" ? "Weekly" : "Monthly"} ${item.goal.metric} goal`,
    description: "Recurring volume target",
    target: `${item.goal.targetValue} ${item.goal.unit}`,
    schedule:
      item.goal.period === "week" ? "Repeats each week" : "Repeats each month",
  };
}

export function GoalProgressPanelSkeleton() {
  return <Skeleton className="h-64 w-full rounded-[1.75rem]" />;
}
