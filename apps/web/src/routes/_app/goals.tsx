import { Button } from "@corex/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { GoalProgressCard } from "@/components/goals/goal-progress-card";
import { GoalStep } from "@/components/onboarding/goal-step";
import { SettingsPageShell } from "@/components/onboarding/settings-page-shell";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { getBrowserTimeZone } from "@/lib/browser-timezone";
import {
  buildTrainingGoalInput,
  createDefaultOnboardingDraft,
  createGoalDraftFromTrainingGoal,
  type GoalDraft,
  type StepErrors,
} from "@/lib/onboarding";
import { queryClient, trpc } from "@/utils/trpc";
import type {
  GoalProgressRouterOutputs,
  GoalsRouterOutputs,
} from "@/utils/types";

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
  const timezone = getBrowserTimeZone();
  const goalsQueryOptions = trpc.goals.get.queryOptions();
  const goalProgressQueryOptions = trpc.goalProgress.get.queryOptions({
    timezone,
  });
  const trainingSettings = useQuery(trpc.trainingSettings.get.queryOptions());
  const goals = useQuery(goalsQueryOptions);
  const goalProgress = useQuery(goalProgressQueryOptions);
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
      void queryClient.invalidateQueries({
        queryKey: goalProgressQueryOptions.queryKey,
      });
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
      void queryClient.invalidateQueries({
        queryKey: goalProgressQueryOptions.queryKey,
      });
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
    active: goalProgress.data?.activeGoals ?? [],
    completed: goalProgress.data?.completedGoals ?? [],
  };
  const goalItemsById = new Map(
    (goals.data ?? []).map((item) => [item.id, item]),
  );

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
              onEdit={(goalId) => {
                const item = goalItemsById.get(goalId);
                if (item) {
                  openEdit(item);
                }
              }}
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
              onEdit={(goalId) => {
                const item = goalItemsById.get(goalId);
                if (item) {
                  openEdit(item);
                }
              }}
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
  items:
    | GoalProgressRouterOutputs["get"]["activeGoals"]
    | GoalProgressRouterOutputs["get"]["completedGoals"];
  emptyMessage: string;
  onEdit: (goalId: string) => void;
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
          <GoalProgressCard
            key={item.goalId}
            card={item}
            onEdit={() => onEdit(item.goalId)}
          />
        ))}
      </div>
    </section>
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
