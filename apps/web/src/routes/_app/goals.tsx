import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@corex/ui/components/dialog";
import { Separator } from "@corex/ui/components/separator";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { GoalStep } from "@/components/onboarding/goal-step";
import { SettingsPageShell } from "@/components/onboarding/settings-page-shell";
import { stepContent } from "@/components/onboarding";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { createDefaultOnboardingDraft, type GoalDraft } from "@/lib/onboarding";

export const Route = createFileRoute("/_app/goals")({
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
  component: RouteComponent,
});

type GoalListItem = {
  id: string;
  status: "Active" | "Draft" | "Upcoming";
  goal: GoalDraft;
};

function RouteComponent() {
  const [goals, setGoals] = useState<GoalListItem[]>(() => createStubGoals());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<GoalDraft>(
    () => createDefaultOnboardingDraft().goal,
  );

  const handleCreateGoal = () => {
    setGoals((currentGoals) => [
      {
        id: `goal-${currentGoals.length + 1}`,
        status: "Draft",
        goal: draft,
      },
      ...currentGoals,
    ]);
    setDraft(createDefaultOnboardingDraft().goal);
    setIsCreateOpen(false);
  };

  return (
    <SettingsPageShell
      eyebrow="Training setup"
      title="Goals"
      description="Start with saved goals, then open the create flow when you want to add another target."
    >
      <div className="flex flex-col gap-6">
        <div className="flex justify-end w-full">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger
              render={
                <Button
                  size="lg"
                  onClick={() => {
                    setDraft(createDefaultOnboardingDraft().goal);
                  }}
                >
                  <PlusIcon />
                  Create goal
                </Button>
              }
            />
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader className="border-b border-border/70 pb-5">
                <DialogTitle>Create goal</DialogTitle>
                <DialogDescription>
                  {stepContent.goal.description}
                </DialogDescription>
              </DialogHeader>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
                <GoalStep draft={draft} errors={{}} onChange={setDraft} />
              </div>

              <Separator />

              <DialogFooter className="border-t border-border/70 pt-5">
                <DialogClose
                  render={<Button variant="outline">Cancel</Button>}
                />
                <Button onClick={handleCreateGoal}>Save draft goal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="divide-y divide-border/70 overflow-hidden rounded-[1.75rem] border border-border/70">
          {goals.map((item) => (
            <GoalListRow key={item.id} item={item} />
          ))}
        </div>
      </div>
    </SettingsPageShell>
  );
}

function GoalListRow({ item }: { item: GoalListItem }) {
  const summary = getGoalSummary(item.goal);
  const statusVariant =
    item.status === "Active"
      ? "default"
      : item.status === "Upcoming"
        ? "secondary"
        : "outline";

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
          <Badge variant={statusVariant}>{item.status}</Badge>
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

function getGoalSummary(goal: GoalDraft) {
  if (goal.type === "event_goal") {
    return {
      title: goal.eventName.trim() || "Event goal",
      description: goal.targetDate
        ? `Targeting ${format(parseISO(goal.targetDate), "d MMM yyyy")}`
        : "Target date to be confirmed",
      target: `${goal.targetDistanceValue} ${goal.targetDistanceUnit}`,
      schedule: goal.targetDate
        ? format(parseISO(goal.targetDate), "EEEE, d MMM")
        : "No date selected",
      notes: goal.notes.trim() || "No notes yet",
    };
  }

  return {
    title: `${goal.period === "week" ? "Weekly" : "Monthly"} ${goal.metric} goal`,
    description: "Volume target for the current training cycle",
    target: `${goal.targetValue} ${goal.unit}`,
    schedule:
      goal.period === "week" ? "Repeats each week" : "Repeats each month",
    notes: goal.notes.trim() || "No notes yet",
  };
}

function createStubGoals(): GoalListItem[] {
  return [
    {
      id: "goal-1",
      status: "Active",
      goal: {
        type: "event_goal",
        targetDistanceValue: "21.1",
        targetDistanceUnit: "km",
        targetDate: "2026-07-12",
        eventName: "Gold Coast Half Marathon",
        targetTimeHours: "1",
        targetTimeMinutes: "42",
        targetTimeSeconds: "0",
        notes: "Primary race for this block.",
      },
    },
    {
      id: "goal-2",
      status: "Upcoming",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: "60",
        unit: "km",
        notes: "Build consistency before the next race build.",
      },
    },
  ];
}
