import type {
  AvailabilityDay,
  GoalDraft,
  OnboardingDraft,
  OnboardingStep,
  StepErrors,
} from "@/lib/onboarding";

import { AvailabilityStep } from "./availability-step";
import { CredentialsStep } from "./credentials-step";
import { GoalStep } from "./goal-step";
import { SyncStep } from "./sync-step";

export function StepContent({
  currentStep,
  draft,
  errors,
  expandedDay,
  isSaving,
  onGoalChange,
  onAvailabilityChange,
  onExpandedDayChange,
  onUsernameChange,
  onApiKeyChange,
  onContinue,
}: {
  currentStep: OnboardingStep;
  draft: OnboardingDraft;
  errors: StepErrors;
  expandedDay: AvailabilityDay;
  isSaving: boolean;
  onGoalChange: (goal: GoalDraft) => void;
  onAvailabilityChange: (availability: OnboardingDraft["availability"]) => void;
  onExpandedDayChange: (day: AvailabilityDay) => void;
  onUsernameChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onContinue: () => void;
}) {
  switch (currentStep) {
    case "goal":
      return (
        <GoalStep draft={draft.goal} errors={errors} onChange={onGoalChange} />
      );
    case "availability":
      return (
        <AvailabilityStep
          availability={draft.availability}
          expandedDay={expandedDay}
          errors={errors}
          onExpandedDayChange={onExpandedDayChange}
          onChange={onAvailabilityChange}
        />
      );
    case "credentials":
      return (
        <CredentialsStep
          draft={draft}
          errors={errors}
          isSaving={isSaving}
          onUsernameChange={onUsernameChange}
          onApiKeyChange={onApiKeyChange}
        />
      );
    case "sync":
      return <SyncStep draft={draft} onContinue={onContinue} />;
  }
}
