import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  OnboardingSkeleton,
  StepContent,
  StepFooter,
  StepHeader,
  getFooterConfig,
  stepContent,
} from "@/components/onboarding";
import { authClient } from "@/lib/auth-client";
import {
  buildTrainingSettingsInput,
  createDefaultOnboardingDraft,
  onboardingSteps,
  validateStep,
  type AvailabilityDay,
  type GoalDraft,
  type OnboardingDraft,
  type StepErrors,
} from "@/lib/onboarding";
import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async ({ context }) => {
    const session = await authClient.getSession();

    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }

    const settings = await context.queryClient.ensureQueryData(
      context.trpc.trainingSettings.get.queryOptions(),
    );

    if (settings.status === "complete") {
      redirect({
        to: "/dashboard",
        throw: true,
      });
    }

    return { session };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const settingsQueryOptions = trpc.trainingSettings.get.queryOptions();
  const settings = useQuery(settingsQueryOptions);
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    createDefaultOnboardingDraft(),
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [errors, setErrors] = useState<StepErrors>({});
  const [expandedDay, setExpandedDay] = useState<AvailabilityDay>("monday");

  const saveSettings = useMutation({
    ...trpc.trainingSettings.upsert.mutationOptions(),
    onSuccess: (data) => {
      queryClient.setQueryData(settingsQueryOptions.queryKey, data);
      setErrors({});
      setCurrentStepIndex(onboardingSteps.indexOf("sync"));
      toast.success("Onboarding settings saved");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const currentStep = onboardingSteps[currentStepIndex];
  const isSaving = saveSettings.isPending;

  if (settings.isLoading) {
    return <OnboardingSkeleton />;
  }

  if (settings.data?.status === "complete") {
    return null;
  }

  const handleGoalChange = (goal: GoalDraft) => {
    setDraft((currentDraft) => ({ ...currentDraft, goal }));
    setErrors({});
  };

  const handleAvailabilityChange = (
    availability: OnboardingDraft["availability"],
  ) => {
    setDraft((currentDraft) => ({ ...currentDraft, availability }));
    setErrors({});
  };

  const handleUsernameChange = (value: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      intervalsUsername: value,
    }));
    setErrors({});
  };

  const handleApiKeyChange = (value: string) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      intervalsApiKey: value,
    }));
    setErrors({});
  };

  const handleBack = () => {
    if (currentStep === "sync") {
      setCurrentStepIndex(onboardingSteps.indexOf("credentials"));
      return;
    }

    setErrors({});
    setCurrentStepIndex((index) => Math.max(index - 1, 0));
  };

  const handleNext = async () => {
    const stepErrors = validateStep(draft, currentStep);

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    if (currentStep === "credentials") {
      const payload = buildTrainingSettingsInput(draft);

      if (!payload.value) {
        setErrors(payload.errors ?? {});
        return;
      }

      await saveSettings.mutateAsync(payload.value);
      return;
    }

    if (currentStep === "sync") {
      await navigate({ to: "/dashboard" });
      return;
    }

    setErrors({});
    setCurrentStepIndex((index) =>
      Math.min(index + 1, onboardingSteps.length - 1),
    );
  };

  return (
    <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl px-8 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <StepHeader
          currentStepIndex={currentStepIndex}
          content={stepContent[currentStep]}
        />

        <section className="flex flex-col gap-8">
          <StepContent
            currentStep={currentStep}
            draft={draft}
            errors={errors}
            expandedDay={expandedDay}
            isSaving={isSaving}
            onGoalChange={handleGoalChange}
            onAvailabilityChange={handleAvailabilityChange}
            onExpandedDayChange={setExpandedDay}
            onUsernameChange={handleUsernameChange}
            onApiKeyChange={handleApiKeyChange}
            onContinue={() => {
              void navigate({ to: "/dashboard" });
            }}
          />
        </section>

        <StepFooter
          currentStepIndex={currentStepIndex}
          isSaving={isSaving}
          onBack={handleBack}
          onNext={() => void handleNext()}
          config={getFooterConfig(currentStep, isSaving)}
        />
      </div>
    </main>
  );
}
