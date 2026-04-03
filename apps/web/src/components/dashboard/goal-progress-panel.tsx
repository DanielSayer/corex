import { Button } from "@corex/ui/components/button";
import { Skeleton } from "@corex/ui/components/skeleton";
import { Link } from "@tanstack/react-router";

import type { GoalProgressRouterOutputs } from "@/utils/types";

import {
  GoalProgressCard,
  GoalProgressCta,
} from "@/components/goals/goal-progress-card";

type GoalProgressView = GoalProgressRouterOutputs["get"];

export function GoalProgressPanel({
  goalProgress,
}: {
  goalProgress: GoalProgressView;
}) {
  const activeGoals = goalProgress.activeGoals;

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
            Live progress is calculated from imported history using your current
            goal definitions and the {goalProgress.timezone} timezone.
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
            <GoalProgressCard key={goal.goalId} card={goal} />
          ))}
        </div>
      ) : (
        <GoalProgressCta />
      )}
    </section>
  );
}

export function GoalProgressPanelSkeleton() {
  return <Skeleton className="h-72 w-full rounded-[1.75rem]" />;
}
