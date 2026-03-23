import type { OnboardingStep } from "@/lib/onboarding";

type TrainingSettingsStatus = "not_started" | "complete";

export function shouldRenderOnboardingStep(
  status: TrainingSettingsStatus | undefined,
  currentStep: OnboardingStep,
) {
  if (status !== "complete") {
    return true;
  }

  return currentStep === "sync";
}
