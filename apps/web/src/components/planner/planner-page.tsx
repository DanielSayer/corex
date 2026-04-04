import { useMutation, useQueryClient } from "@tanstack/react-query";
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

import type { PlannerRouterOutputs } from "@/utils/types";
import {
  ESTIMATED_RACE_DISTANCES,
  LONG_RUN_DAYS,
  USER_PERCEIVED_ABILITIES,
} from "./planner-constants";
import { PlannerDraftView } from "./planner-draft-view";
import { PlannerGenerateDraftCard } from "./planner-generate-draft-card";
import { PlannerHeader } from "./planner-header";

type PlannerPageProps = {
  plannerForm: PlannerRouterOutputs["getState"];
};

export function PlannerPage({ plannerForm }: PlannerPageProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlannerFormState>(
    createPlannerFormState(plannerForm),
  );
  const generateDraft = useMutation({
    ...trpc.weeklyPlanning.generateDraft.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: trpc.weeklyPlanning.getState.queryOptions().queryKey,
      });
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
    if (!form || !raceTimeSeconds) {
      return;
    }

    generateDraft.mutate({
      goalId: form.goalId,
      startDate: form.startDate,
      longRunDay: form.longRunDay as (typeof LONG_RUN_DAYS)[number],
      planDurationWeeks: Number.parseInt(form.planDurationWeeks, 10),
      userPerceivedAbility:
        form.userPerceivedAbility as (typeof USER_PERCEIVED_ABILITIES)[number],
      estimatedRaceDistance:
        form.estimatedRaceDistance as (typeof ESTIMATED_RACE_DISTANCES)[number],
      estimatedRaceTimeSeconds: raceTimeSeconds,
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-12 md:px-8">
      <PlannerHeader
        goalCount={plannerForm.goalCandidates.length ?? 0}
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
        <PlannerDraftView draft={plannerForm.activeDraft} />
      ) : (
        <PlannerGenerateDraftCard
          errorMessage={generateDraft.error?.message ?? null}
          form={form}
          goalCandidates={plannerForm.goalCandidates}
          isGenerating={generateDraft.isPending}
          isLowHistoryMode={!plannerForm.historyQuality.meetsSnapshotThreshold}
          onFormChange={handleFormChange}
          onGenerateDraft={handleGenerateDraft}
          raceTimeSeconds={raceTimeSeconds}
        />
      )}
    </main>
  );
}
