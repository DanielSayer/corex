import { Button } from "@corex/ui/components/button";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
} from "lucide-react";

import type { OnboardingStep } from "@/lib/onboarding";

type FooterConfig = {
  label: string;
  leadingIcon: React.ReactNode;
  showTrailingArrow: boolean;
};

export function StepFooter({
  currentStepIndex,
  isSaving,
  onBack,
  onNext,
  config,
}: {
  currentStepIndex: number;
  isSaving: boolean;
  onBack: () => void;
  onNext: () => void;
  config: FooterConfig;
}) {
  return (
    <footer className="mt-auto flex items-center justify-between border-t border-border/70 pt-8">
      <Button
        variant="ghost"
        onClick={onBack}
        disabled={currentStepIndex === 0 || isSaving}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back
      </Button>
      <Button onClick={onNext} disabled={isSaving}>
        {config.leadingIcon}
        {config.label}
        {config.showTrailingArrow ? (
          <ArrowRightIcon data-icon="inline-end" />
        ) : null}
      </Button>
    </footer>
  );
}

export function getFooterConfig(
  currentStep: OnboardingStep,
  isSaving: boolean,
): FooterConfig {
  if (currentStep === "credentials") {
    return {
      label: "Save settings",
      leadingIcon: isSaving ? (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      ) : (
        <CheckCircle2Icon data-icon="inline-start" />
      ),
      showTrailingArrow: false,
    };
  }

  if (currentStep === "sync") {
    return {
      label: "Continue to dashboard",
      leadingIcon: null,
      showTrailingArrow: true,
    };
  }

  return {
    label: "Continue",
    leadingIcon: null,
    showTrailingArrow: true,
  };
}
