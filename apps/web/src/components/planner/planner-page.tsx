import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createPlannerFormState,
  parseRaceTimeToSeconds,
  type PlannerFormState,
} from "@/lib/planner";
import { trpc } from "@/utils/trpc";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";

import type { PlannerRouterOutputs } from "@/utils/types";
import type { PlanAdherenceSummary } from "@corex/api/plan-adherence/contracts";
import type { WeeklyPlanFinalized } from "@corex/api/weekly-planning/contracts";
import {
  ESTIMATED_RACE_DISTANCES,
  LONG_RUN_DAYS,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITIES,
} from "./planner-constants";
import { PlannerDraftView } from "./planner-draft-view";
import { PlannerGenerateDraftCard } from "./planner-generate-draft-card";
import { PlannerHeader } from "./planner-header";

type PlannerPageProps = {
  plannerForm: PlannerRouterOutputs["getState"];
};

function countScheduledSessions(plan: WeeklyPlanFinalized) {
  return plan.payload.days.filter((day) => day.session).length;
}

function FinalizedPlanCard(props: {
  plan: WeeklyPlanFinalized;
  adherence: PlanAdherenceSummary | null;
  title: string;
  description: string;
}) {
  const plan = props.plan;
  const adherence = props.adherence;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{plan.startDate}</Badge>
          <Badge variant="outline">{plan.endDate}</Badge>
          <Badge variant="outline">
            {countScheduledSessions(plan)} scheduled sessions
          </Badge>
          {adherence ? (
            <>
              <Badge variant="outline">
                {adherence.totals.completedCount + adherence.totals.movedCount}{" "}
                completed
              </Badge>
              <Badge variant="outline">
                {adherence.totals.missedCount} missed
              </Badge>
              <Badge variant="outline">
                {adherence.totals.extraCount} extra
              </Badge>
            </>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {plan.payload.days.map((day) => (
            <div
              className="rounded-lg border border-border/70 p-3 text-sm"
              key={day.date}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 font-medium">
                <span>{day.date}</span>
                <Badge variant="secondary">
                  {day.session?.sessionType ?? "rest"}
                </Badge>
              </div>
              <p className="mt-2 text-muted-foreground">
                {day.session?.title ?? "Recovery / no scheduled session"}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FinalizedHistoryCard(props: {
  history: PlannerRouterOutputs["listFinalizedPlans"] | undefined;
  isLoading: boolean;
}) {
  const plans = props.history?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Finalized history</CardTitle>
        <CardDescription>Recent weeks you committed to.</CardDescription>
      </CardHeader>
      <CardContent>
        {props.isLoading ? (
          <p className="text-sm text-muted-foreground">
            Loading finalized plans...
          </p>
        ) : plans.length > 0 ? (
          <div className="flex flex-col gap-3">
            {plans.map((plan) => (
              <div
                className="flex flex-col gap-2 rounded-lg border border-border/70 p-3 md:flex-row md:items-center md:justify-between"
                key={plan.id}
              >
                <div>
                  <div className="font-medium">
                    {plan.startDate} to {plan.endDate}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {countScheduledSessions(plan)} scheduled sessions
                  </div>
                </div>
                <Badge variant="outline">
                  {plan.generationContext.plannerIntent.planGoal}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Finalized weeks will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PlannerPage({ plannerForm }: PlannerPageProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlannerFormState>(
    createPlannerFormState(plannerForm),
  );
  const finalizedHistoryQueryOptions =
    trpc.weeklyPlanning.listFinalizedPlans.queryOptions({
      limit: 10,
      offset: 0,
    });
  const finalizedHistory = useQuery(finalizedHistoryQueryOptions);
  const generateDraft = useMutation({
    ...trpc.weeklyPlanning.generateDraft.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.weeklyPlanning.getState.queryOptions().queryKey,
      });
    },
  });
  const updateDraftSession = useMutation({
    ...trpc.weeklyPlanning.updateDraftSession.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.weeklyPlanning.getState.queryOptions().queryKey,
      });
    },
  });
  const moveDraftSession = useMutation({
    ...trpc.weeklyPlanning.moveDraftSession.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.weeklyPlanning.getState.queryOptions().queryKey,
      });
    },
  });
  const regenerateDraft = useMutation({
    ...trpc.weeklyPlanning.regenerateDraft.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.weeklyPlanning.getState.queryOptions().queryKey,
      });
    },
  });
  const finalizeDraft = useMutation({
    ...trpc.weeklyPlanning.finalizeDraft.mutationOptions(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpc.weeklyPlanning.getState.queryOptions().queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: finalizedHistoryQueryOptions.queryKey,
        }),
      ]);
    },
  });

  const warnings = plannerForm?.historyQuality.latestSyncWarnings ?? [];
  const raceTimeSeconds = form
    ? parseRaceTimeToSeconds(form.estimatedRaceTime)
    : null;

  const handleFormChange = (
    updater: (current: PlannerFormState) => PlannerFormState,
  ) => {
    setForm((current) => (current ? updater(current) : current));
  };

  const handleGenerateDraft = () => {
    if (!form) {
      return;
    }

    if (form.planGoal === "race") {
      if (!raceTimeSeconds) {
        return;
      }

      generateDraft.mutate({
        planGoal: TRAINING_PLAN_GOALS[0],
        startDate: form.startDate,
        longRunDay: form.longRunDay as (typeof LONG_RUN_DAYS)[number],
        planDurationWeeks: Number.parseInt(form.planDurationWeeks, 10),
        userPerceivedAbility:
          form.userPerceivedAbility as (typeof USER_PERCEIVED_ABILITIES)[number],
        raceBenchmark: {
          estimatedRaceDistance:
            form.estimatedRaceDistance as (typeof ESTIMATED_RACE_DISTANCES)[number],
          estimatedRaceTimeSeconds: raceTimeSeconds,
        },
      });

      return;
    }

    generateDraft.mutate({
      planGoal: form.planGoal as Exclude<
        (typeof TRAINING_PLAN_GOALS)[number],
        "race"
      >,
      startDate: form.startDate,
      longRunDay: form.longRunDay as (typeof LONG_RUN_DAYS)[number],
      planDurationWeeks: Number.parseInt(form.planDurationWeeks, 10),
      userPerceivedAbility:
        form.userPerceivedAbility as (typeof USER_PERCEIVED_ABILITIES)[number],
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-12 md:px-8">
      <PlannerHeader
        planGoalCount={plannerForm.planGoalOptions.length ?? 0}
        meetsSnapshotThreshold={
          plannerForm.historyQuality.meetsSnapshotThreshold ?? false
        }
        hasRecentSync={plannerForm.historyQuality.hasRecentSync ?? false}
        hasActiveDraft={Boolean(plannerForm.activeDraft)}
      />

      {warnings.length > 0 ? (
        <Alert>
          <AlertTitle>History quality warnings</AlertTitle>
          <AlertDescription>
            {warnings.join(", ")}. Planning can continue, but stale or partial
            sync data will reduce confidence in the draft.
          </AlertDescription>
        </Alert>
      ) : null}

      {plannerForm.activeDraft ? (
        <PlannerDraftView
          draft={plannerForm.activeDraft}
          errorMessage={
            updateDraftSession.error?.message ??
            moveDraftSession.error?.message ??
            regenerateDraft.error?.message ??
            finalizeDraft.error?.message ??
            null
          }
          isFinalizing={finalizeDraft.isPending}
          isMoving={moveDraftSession.isPending}
          isRegenerating={regenerateDraft.isPending}
          isUpdating={updateDraftSession.isPending}
          key={`${plannerForm.activeDraft.id}-${plannerForm.activeDraft.updatedAt}`}
          onMoveSession={(input) =>
            moveDraftSession.mutate({
              draftId: plannerForm.activeDraft!.id,
              ...input,
            })
          }
          onRegenerate={() =>
            regenerateDraft.mutate({ draftId: plannerForm.activeDraft!.id })
          }
          onFinalize={() =>
            finalizeDraft.mutate({ draftId: plannerForm.activeDraft!.id })
          }
          onUpdateSession={(input) =>
            updateDraftSession.mutate({
              draftId: plannerForm.activeDraft!.id,
              ...input,
            })
          }
        />
      ) : (
        <PlannerGenerateDraftCard
          errorMessage={generateDraft.error?.message ?? null}
          form={form}
          planGoalOptions={plannerForm.planGoalOptions}
          isGenerating={generateDraft.isPending}
          isLowHistoryMode={!plannerForm.historyQuality.meetsSnapshotThreshold}
          onFormChange={handleFormChange}
          onGenerateDraft={handleGenerateDraft}
          raceTimeSeconds={raceTimeSeconds}
        />
      )}

      {plannerForm.currentFinalizedPlan ? (
        <FinalizedPlanCard
          adherence={plannerForm.currentFinalizedPlanAdherence}
          description="Stable plan for this week."
          plan={plannerForm.currentFinalizedPlan}
          title="Current finalized week"
        />
      ) : null}

      <FinalizedHistoryCard
        history={finalizedHistory.data}
        isLoading={finalizedHistory.isLoading}
      />
    </main>
  );
}
