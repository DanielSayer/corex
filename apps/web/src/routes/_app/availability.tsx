import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AvailabilityStep } from "@/components/onboarding/availability-step";
import { stepContent } from "@/components/onboarding";
import { SettingsPageShell } from "@/components/onboarding/settings-page-shell";
import { ensureAppRouteAccess } from "@/lib/app-route";
import {
  createDefaultOnboardingDraft,
  type AvailabilityDay,
  type OnboardingDraft,
} from "@/lib/onboarding";

export const Route = createFileRoute("/_app/availability")({
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
  component: RouteComponent,
});

function RouteComponent() {
  const [availability, setAvailability] = useState<
    OnboardingDraft["availability"]
  >(() => createDefaultOnboardingDraft().availability);
  const [expandedDay, setExpandedDay] = useState<AvailabilityDay>("monday");

  return (
    <SettingsPageShell
      eyebrow="Training setup"
      title="Availability"
      description="Block out the days you can realistically use before plan editing is connected."
      sectionTitle="Weekly availability"
      sectionDescription={stepContent.availability.description}
    >
      <AvailabilityStep
        availability={availability}
        expandedDay={expandedDay}
        errors={{}}
        onExpandedDayChange={setExpandedDay}
        onChange={setAvailability}
      />
    </SettingsPageShell>
  );
}
