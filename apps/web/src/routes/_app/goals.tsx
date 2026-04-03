import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { GoalStep } from "@/components/onboarding/goal-step";
import { SettingsPageShell } from "@/components/onboarding/settings-page-shell";
import { ensureAppRouteAccess } from "@/lib/app-route";
import {
  buildTrainingGoalInput,
  createDefaultOnboardingDraft,
  createGoalDraftFromTrainingGoal,
  type GoalDraft,
  type StepErrors,
} from "@/lib/onboarding";
import { queryClient, trpc } from "@/utils/trpc";
import type { GoalsRouterOutputs } from "@/utils/types";

export const Route = createFileRoute("/_app/goals")({
  beforeLoad: async ({ context }) => {
    const routeContext = await ensureAppRouteAccess(context);

    await Promise.all([
      context.queryClient.ensureQueryData(
        context.trpc.goals.get.queryOptions(),
      ),
      context.queryClient.ensureQueryData(
        context.trpc.goalProgress.get.queryOptions(),
      ),
    ]);

    return routeContext;
  },
  component: RouteComponent,
});

type GoalListItem = GoalsRouterOutputs["get"][number];

function RouteComponent() {
  const goalsQueryOptions = trpc.goals.get.queryOptions();
  const trainingSettings = useQuery(trpc.trainingSettings.get.queryOptions());
  const goals = useQuery(goalsQueryOptions);
  const goalItem = goals.data?.[0] ?? null;
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<GoalDraft>(
    () => createDefaultOnboardingDraft().goal,
  );
  const [errors, setErrors] = useState<StepErrors>({});

  const updateGoal = useMutation({
    ...trpc.goals.update.mutationOptions(),
    onSuccess: async (updatedGoal) => {
      queryClient.setQueryData(goalsQueryOptions.queryKey, [updatedGoal]);
      await queryClient.invalidateQueries({
        queryKey: trpc.goalProgress.get.queryOptions().queryKey,
      });
      setDraft(createGoalDraftFromTrainingGoal(updatedGoal.goal));
      setErrors({});
      setIsEditing(false);
      toast.success("Goal updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSave = async () => {
    const result = buildTrainingGoalInput(draft);

    if (!result.value) {
      setErrors(result.errors ?? {});
      return;
    }

    await updateGoal.mutateAsync(result.value);
  };

  return (
    <SettingsPageShell
      eyebrow="Training setup"
      title="Goals"
      description="This page owns the saved goal definition. Live progress now belongs on the dashboard where the imported history already lives."
      aside={
        <GoalAside
          isEditing={isEditing}
          hasGoal={Boolean(goalItem)}
          onEdit={() => {
            setDraft(
              goalItem
                ? createGoalDraftFromTrainingGoal(goalItem.goal)
                : createDefaultOnboardingDraft().goal,
            );
            setErrors({});
            setIsEditing(true);
          }}
        />
      }
    >
      {goals.isLoading ? (
        <GoalsLoadingState />
      ) : isEditing ? (
        <GoalEditor
          draft={draft}
          errors={errors}
          isSaving={updateGoal.isPending}
          onChange={(nextGoal) => {
            setDraft(nextGoal);
            setErrors({});
          }}
          onCancel={() => {
            setDraft(
              goalItem
                ? createGoalDraftFromTrainingGoal(goalItem.goal)
                : createDefaultOnboardingDraft().goal,
            );
            setErrors({});
            setIsEditing(false);
          }}
          onSave={() => void handleSave()}
        />
      ) : goalItem ? (
        <GoalDetail item={goalItem} onEdit={() => setIsEditing(true)} />
      ) : (
        <EmptyGoalsState
          canCreateInline={trainingSettings.data?.status === "complete"}
          onCreate={() => setIsEditing(true)}
        />
      )}
    </SettingsPageShell>
  );
}

function GoalEditor({
  draft,
  errors,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: {
  draft: GoalDraft;
  errors: StepErrors;
  isSaving: boolean;
  onChange: (goal: GoalDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="text-sm font-medium">Edit goal</div>
        <p className="text-sm text-muted-foreground">
          Keep the saved target current. The dashboard will re-read progress
          from this goal after the change lands.
        </p>
      </div>

      <GoalStep draft={draft} errors={errors} onChange={onChange} />

      <div className="flex flex-wrap gap-3">
        <Button disabled={isSaving} onClick={onSave}>
          {isSaving ? "Saving goal" : "Save goal"}
        </Button>
        <Button variant="outline" disabled={isSaving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function GoalDetail({
  item,
  onEdit,
}: {
  item: GoalListItem;
  onEdit: () => void;
}) {
  const summary = getGoalSummary(item.goal);

  return (
    <article className="rounded-[1.75rem] border border-border/70 px-6 py-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-[1.3rem] font-semibold tracking-tight">
                {summary.title}
              </h2>
              <Badge variant="secondary">{formatGoalStatus(item.status)}</Badge>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {summary.description}
            </p>
          </div>
          <Button variant="outline" onClick={onEdit}>
            Edit goal
          </Button>
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

function GoalAside({
  hasGoal,
  isEditing,
  onEdit,
}: {
  hasGoal: boolean;
  isEditing: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border/70 px-5 py-5">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-sm font-medium">Live progress moved</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The dashboard now owns the live progress story because it already
            has the sync and history context. Use this page to keep the goal
            itself accurate.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/dashboard" className="text-sm font-medium text-primary">
            View dashboard progress
          </Link>
          {hasGoal && !isEditing ? (
            <button
              type="button"
              onClick={onEdit}
              className="text-left text-sm font-medium text-primary"
            >
              Edit this goal
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GoalsLoadingState() {
  return (
    <div className="rounded-[1.75rem] border border-border/70 px-6 py-8 text-sm text-muted-foreground">
      Loading saved goal...
    </div>
  );
}

function EmptyGoalsState({
  canCreateInline,
  onCreate,
}: {
  canCreateInline: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-border/70 px-6 py-8">
      <div className="flex flex-col gap-3">
        <h3 className="text-[1.1rem] font-semibold tracking-tight">
          No saved goal yet
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {canCreateInline
            ? "Set the target here, then head back to the dashboard once Intervals history has been synced."
            : "Finish onboarding first so availability and Intervals credentials exist alongside the goal."}
        </p>
        {canCreateInline ? (
          <div>
            <Button onClick={onCreate}>Create goal</Button>
          </div>
        ) : (
          <div>
            <Link to="/onboarding" className="text-sm font-medium text-primary">
              Go to onboarding
            </Link>
          </div>
        )}
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
  return status === "active" ? "Active" : status;
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
    description:
      "This target is tracked live from your imported history on the dashboard.",
    target: `${goal.targetValue} ${goal.unit}`,
    schedule:
      goal.period === "week" ? "Repeats each week" : "Repeats each month",
    notes: goal.notes?.trim() || "No notes yet",
  };
}
