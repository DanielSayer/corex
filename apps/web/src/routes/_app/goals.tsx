import { Badge } from "@corex/ui/components/badge";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";

import { SettingsPageShell } from "@/components/onboarding/settings-page-shell";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { trpc } from "@/utils/trpc";
import type { GoalsRouterOutputs } from "@/utils/types";

export const Route = createFileRoute("/_app/goals")({
  beforeLoad: async ({ context }) => {
    const routeContext = await ensureAppRouteAccess(context);

    await context.queryClient.ensureQueryData(
      context.trpc.goals.get.queryOptions(),
    );

    return routeContext;
  },
  component: RouteComponent,
});

type GoalListItem = GoalsRouterOutputs["get"][number];

function RouteComponent() {
  const goals = useQuery(trpc.goals.get.queryOptions());

  return (
    <SettingsPageShell
      eyebrow="Training setup"
      title="Goals"
      description="Your persisted training goal is loaded from the API so this page reflects the current saved setup."
    >
      <div className="flex flex-col gap-6">
        {goals.isLoading ? <GoalsLoadingState /> : null}

        {!goals.isLoading && (goals.data?.length ?? 0) === 0 ? (
          <EmptyGoalsState />
        ) : null}

        {!goals.isLoading && (goals.data?.length ?? 0) > 0 ? (
          <div className="divide-y divide-border/70 overflow-hidden rounded-[1.75rem] border border-border/70">
            {goals.data?.map((item) => (
              <GoalListRow key={item.id} item={item} />
            ))}
          </div>
        ) : null}
      </div>
    </SettingsPageShell>
  );
}

function GoalListRow({ item }: { item: GoalListItem }) {
  const summary = getGoalSummary(item.goal);

  return (
    <article className="px-6 py-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-[1.1rem] font-semibold tracking-tight">
              {summary.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {summary.description}
            </p>
          </div>
          <Badge variant="default">{formatGoalStatus(item.status)}</Badge>
        </div>

        <div className="grid gap-3 border-t border-border/70 pt-5 text-sm md:grid-cols-3">
          <GoalMeta label="Target" value={summary.target} />
          <GoalMeta label="Schedule" value={summary.schedule} />
          <GoalMeta label="Notes" value={summary.notes} />
        </div>
      </div>
    </article>
  );
}

function GoalsLoadingState() {
  return (
    <div className="rounded-[1.75rem] border border-border/70 px-6 py-8 text-sm text-muted-foreground">
      Loading saved goals...
    </div>
  );
}

function EmptyGoalsState() {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-border/70 px-6 py-8">
      <div className="flex flex-col gap-2">
        <h3 className="text-[1.1rem] font-semibold tracking-tight">
          No saved goals yet
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This page now reads persisted goals from the API. Once a goal is saved
          through the training settings flow, it will appear here.
        </p>
      </div>
    </div>
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

function formatGoalStatus(status: GoalListItem["status"]) {
  if (status === "active") {
    return "Active";
  }

  return status;
}

function getGoalSummary(goal: GoalListItem["goal"]) {
  if (goal.type === "event_goal") {
    return {
      title: goal.eventName?.trim() || "Event goal",
      description: `Targeting ${format(parseISO(goal.targetDate), "d MMM yyyy")}`,
      target: `${goal.targetDistance.value} ${goal.targetDistance.unit}`,
      schedule: format(parseISO(goal.targetDate), "EEEE, d MMM"),
      notes: goal.notes?.trim() || "No notes yet",
    };
  }

  return {
    title: `${goal.period === "week" ? "Weekly" : "Monthly"} ${goal.metric} goal`,
    description: "Volume target for the current training cycle",
    target: `${goal.targetValue} ${goal.unit}`,
    schedule:
      goal.period === "week" ? "Repeats each week" : "Repeats each month",
    notes: goal.notes?.trim() || "No notes yet",
  };
}
