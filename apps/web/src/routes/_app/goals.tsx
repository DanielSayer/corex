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

    await context.queryClient.ensureQueryData(
      context.trpc.goals.get.queryOptions(),
    );

    return routeContext;
  },
  component: RouteComponent,
});

type GoalListItem = GoalsRouterOutputs["get"][number];
type EditorMode = { type: "create" } | { type: "edit"; id: string } | null;

function RouteComponent() {
  const goalsQueryOptions = trpc.goals.get.queryOptions();
  const trainingSettings = useQuery(trpc.trainingSettings.get.queryOptions());
  const goals = useQuery(goalsQueryOptions);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [draft, setDraft] = useState<GoalDraft>(
    () => createDefaultOnboardingDraft().goal,
  );
  const [errors, setErrors] = useState<StepErrors>({});

  const createGoal = useMutation({
    ...trpc.goals.create.mutationOptions(),
    onSuccess: (createdGoal) => {
      queryClient.setQueryData(
        goalsQueryOptions.queryKey,
        (current: GoalListItem[] = []) => [createdGoal, ...current],
      );
      setDraft(createGoalDraftFromTrainingGoal(createdGoal.goal));
      setErrors({});
      setEditorMode(null);
      toast.success("Goal created");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateGoal = useMutation({
    ...trpc.goals.update.mutationOptions(),
    onSuccess: (updatedGoal) => {
      queryClient.setQueryData(
        goalsQueryOptions.queryKey,
        (current: GoalListItem[] = []) =>
          current.map((item) =>
            item.id === updatedGoal.id ? updatedGoal : item,
          ),
      );
      setDraft(createGoalDraftFromTrainingGoal(updatedGoal.goal));
      setErrors({});
      setEditorMode(null);
      toast.success("Goal updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const groupedGoals = {
    active: (goals.data ?? []).filter((item) => item.status === "active"),
    completed: (goals.data ?? []).filter((item) => item.status === "completed"),
  };

  const isSaving = createGoal.isPending || updateGoal.isPending;

  function openCreate() {
    setDraft(createDefaultOnboardingDraft().goal);
    setErrors({});
    setEditorMode({ type: "create" });
  }

  function openEdit(item: GoalListItem) {
    setDraft(createGoalDraftFromTrainingGoal(item.goal));
    setErrors({});
    setEditorMode({ type: "edit", id: item.id });
  }

  async function handleSave() {
    const result = buildTrainingGoalInput(draft);

    if (!result.value) {
      setErrors(result.errors ?? {});
      return;
    }

    if (editorMode?.type === "edit") {
      await updateGoal.mutateAsync({
        id: editorMode.id,
        goal: result.value,
      });
      return;
    }

    await createGoal.mutateAsync(result.value);
  }

  return (
    <SettingsPageShell
      eyebrow="Training setup"
      title="Goals"
      description="Keep multiple goals in play at once. Event goals move to completed automatically after the target date passes."
      aside={
        <GoalAside
          canCreateInline={trainingSettings.data?.status === "complete"}
          onCreate={openCreate}
        />
      }
    >
      {goals.isLoading ? (
        <GoalsLoadingState />
      ) : editorMode ? (
        <GoalEditor
          mode={editorMode.type}
          draft={draft}
          errors={errors}
          isSaving={isSaving}
          onChange={(nextGoal) => {
            setDraft(nextGoal);
            setErrors({});
          }}
          onCancel={() => {
            setErrors({});
            setEditorMode(null);
          }}
          onSave={() => void handleSave()}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groupedGoals.active.length > 0 ? (
            <GoalSection
              title="Active goals"
              items={groupedGoals.active}
              emptyMessage=""
              onEdit={openEdit}
            />
          ) : (
            <EmptyGoalsState
              canCreateInline={trainingSettings.data?.status === "complete"}
              onCreate={openCreate}
            />
          )}

          {groupedGoals.completed.length > 0 ? (
            <GoalSection
              title="Completed event goals"
              items={groupedGoals.completed}
              emptyMessage=""
              onEdit={openEdit}
            />
          ) : null}
        </div>
      )}
    </SettingsPageShell>
  );
}

function GoalEditor({
  mode,
  draft,
  errors,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
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
        <div className="text-sm font-medium">
          {mode === "create" ? "Create goal" : "Edit goal"}
        </div>
        <p className="text-sm text-muted-foreground">
          Save event and volume goals side by side. Past event dates will move a
          goal into the completed section automatically.
        </p>
      </div>

      <GoalStep draft={draft} errors={errors} onChange={onChange} />

      <div className="flex flex-wrap gap-3">
        <Button disabled={isSaving} onClick={onSave}>
          {isSaving
            ? mode === "create"
              ? "Creating goal"
              : "Saving goal"
            : mode === "create"
              ? "Create goal"
              : "Save goal"}
        </Button>
        <Button variant="outline" disabled={isSaving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function GoalSection({
  title,
  items,
  emptyMessage,
  onEdit,
}: {
  title: string;
  items: GoalListItem[];
  emptyMessage: string;
  onEdit: (item: GoalListItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-border/70 px-6 py-8 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="grid gap-4">
        {items.map((item) => (
          <GoalCard key={item.id} item={item} onEdit={() => onEdit(item)} />
        ))}
      </div>
    </section>
  );
}

function GoalCard({
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
              <Badge
                variant={item.status === "active" ? "secondary" : "outline"}
              >
                {item.status === "active" ? "Active" : "Completed"}
              </Badge>
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
  canCreateInline,
  onCreate,
}: {
  canCreateInline: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-border/70 px-5 py-5">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-sm font-medium">Goals now stack</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Keep race targets and recurring volume goals together. The dashboard
            shows active goals in a lighter summary now, while this page owns
            the full definitions.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Link to="/dashboard" className="text-sm font-medium text-primary">
            View dashboard goals
          </Link>
          {canCreateInline ? (
            <button
              type="button"
              onClick={onCreate}
              className="text-left text-sm font-medium text-primary"
            >
              Create another goal
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
      Loading goals...
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
          No saved goals yet
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {canCreateInline
            ? "Create your first goal here. You can keep multiple goals active at the same time."
            : "Finish onboarding first so availability and Intervals credentials exist before goals are added."}
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
    description: "Recurring volume targets stay active until you edit them.",
    target: `${goal.targetValue} ${goal.unit}`,
    schedule:
      goal.period === "week" ? "Repeats each week" : "Repeats each month",
    notes: goal.notes?.trim() || "No notes yet",
  };
}
