import { Link } from "@tanstack/react-router";

import type { DashboardRouterOutputs } from "@/utils/types";

type DashboardData = DashboardRouterOutputs["get"];

export function GoalsPanel({ goals }: { goals: DashboardData["goals"] }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card/75 p-5 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.7)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Goals</h2>
          <p className="text-sm text-muted-foreground">
            {goals.length}/3 highlighted on dashboard
          </p>
        </div>
        <Link to="/goals" className="text-sm font-medium text-primary">
          View all
        </Link>
      </div>
      <div className="space-y-4">
        {goals.length > 0 ? (
          goals.map((goal) => (
            <div key={goal.goalId} className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{goal.title}</p>
                  <p className="text-xs text-muted-foreground">{goal.label}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {goal.progressLabel}
                  </p>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${Math.round(goal.progressRatio * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
            No active goals available.
          </div>
        )}
      </div>
    </section>
  );
}
