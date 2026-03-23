import type { AvailabilityDay, OnboardingStep } from "@/lib/onboarding";

export const stepContent: Record<
  OnboardingStep,
  { eyebrow: string; title: string; description: string }
> = {
  goal: {
    eyebrow: "Step 1",
    title: "What are you training for?",
    description: "Choose the goal shape that best fits this training cycle.",
  },
  availability: {
    eyebrow: "Step 2",
    title: "When can you run?",
    description:
      "Pick the days that are available and set a practical duration cap.",
  },
  credentials: {
    eyebrow: "Step 3",
    title: "Connect Intervals",
    description: "Save the credentials we will use later for manual sync.",
  },
  sync: {
    eyebrow: "Step 4",
    title: "You are ready",
    description:
      "Settings are saved. The first sync stays stubbed in this pass.",
  },
};

export const dayLabels: Record<AvailabilityDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
