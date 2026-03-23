import type { OnboardingStep } from "@/lib/onboarding";

type TrainingSettingsStatus = "not_started" | "complete";

export function shouldRenderOnboardingStep(
  status: TrainingSettingsStatus | undefined,
  currentStep: OnboardingStep,
  allowCompletedOnboardingSession: boolean,
) {
  if (status !== "complete") {
    return true;
  }

  if (allowCompletedOnboardingSession) {
    return true;
  }

  return currentStep === "sync";
}
