import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@corex/ui/components/button";
import { Input } from "@corex/ui/components/input";

import { AvailabilityStep } from "@/components/onboarding/availability-step";
import { stepContent } from "@/components/onboarding";
import { SettingsPageShell } from "@/components/onboarding/settings-page-shell";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { queryClient, trpc } from "@/utils/trpc";
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
  const settingsQueryOptions = trpc.trainingSettings.get.queryOptions();
  const settings = useQuery(settingsQueryOptions);

  if (settings.isLoading) {
    return (
      <SettingsPageShell
        eyebrow="Training setup"
        title="Availability"
        description="Block out the days you can realistically use before plan editing is connected."
        sectionTitle="Weekly availability"
        sectionDescription={stepContent.availability.description}
      >
        <div className="text-sm text-muted-foreground">
          Loading availability settings...
        </div>
      </SettingsPageShell>
    );
  }

  return (
    <AvailabilitySettingsForm
      initialTimezone={settings.data?.preferences.timezone ?? "UTC"}
      settingsQueryKey={settingsQueryOptions.queryKey}
      key={settings.data?.preferences.timezone ?? "UTC"}
    />
  );
}

type AvailabilitySettingsFormProps = {
  initialTimezone: string;
  settingsQueryKey: ReturnType<
    typeof trpc.trainingSettings.get.queryOptions
  >["queryKey"];
};

function AvailabilitySettingsForm(props: AvailabilitySettingsFormProps) {
  const [availability, setAvailability] = useState<
    OnboardingDraft["availability"]
  >(() => createDefaultOnboardingDraft().availability);
  const [expandedDay, setExpandedDay] = useState<AvailabilityDay>("monday");
  const [timezone, setTimezone] = useState(props.initialTimezone);
  const updateTimezone = useMutation({
    ...trpc.trainingSettings.updateTimezone.mutationOptions(),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(props.settingsQueryKey, updatedSettings);
      toast.success("Timezone updated");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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
      <section className="flex max-w-xl flex-col gap-4 border-t border-border/70 pt-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold tracking-tight">Timezone</h3>
          <p className="text-sm text-muted-foreground">
            Local weeks, monthly progress, analytics, calendar links, and weekly
            reviews use this timezone.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-2 text-sm font-medium">
            IANA timezone
            <Input
              value={timezone}
              placeholder="Australia/Brisbane"
              aria-invalid={updateTimezone.isError}
              onChange={(event) => setTimezone(event.currentTarget.value)}
            />
          </label>
          <Button
            disabled={updateTimezone.isPending}
            onClick={() =>
              updateTimezone.mutate({
                timezone,
              })
            }
          >
            {updateTimezone.isPending ? "Saving" : "Save timezone"}
          </Button>
        </div>
      </section>
    </SettingsPageShell>
  );
}
