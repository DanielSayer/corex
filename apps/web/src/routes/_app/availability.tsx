import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@corex/ui/components/button";
import { Checkbox } from "@corex/ui/components/checkbox";
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
      initialAutomaticWeeklyPlanRenewalEnabled={
        settings.data?.preferences.automaticWeeklyPlanRenewalEnabled ?? false
      }
      initialTimezone={settings.data?.preferences.timezone ?? "UTC"}
      settingsQueryKey={settingsQueryOptions.queryKey}
      key={`${settings.data?.preferences.timezone ?? "UTC"}-${settings.data?.preferences.automaticWeeklyPlanRenewalEnabled ?? false}`}
    />
  );
}

type AvailabilitySettingsFormProps = {
  initialAutomaticWeeklyPlanRenewalEnabled: boolean;
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
  const [
    automaticWeeklyPlanRenewalEnabled,
    setAutomaticWeeklyPlanRenewalEnabled,
  ] = useState(props.initialAutomaticWeeklyPlanRenewalEnabled);
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
  const updateAutomaticWeeklyPlanRenewal = useMutation({
    ...trpc.trainingSettings.updateAutomaticWeeklyPlanRenewal.mutationOptions(),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(props.settingsQueryKey, updatedSettings);
      toast.success("Automatic renewal updated");
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
        <div className="flex items-start gap-3 rounded-lg border border-border/70 p-4">
          <Checkbox
            checked={automaticWeeklyPlanRenewalEnabled}
            disabled={updateAutomaticWeeklyPlanRenewal.isPending}
            id="automatic-weekly-plan-renewal"
            onCheckedChange={(value) => {
              const enabled = Boolean(value);
              setAutomaticWeeklyPlanRenewalEnabled(enabled);
              updateAutomaticWeeklyPlanRenewal.mutate({ enabled });
            }}
          />
          <label
            className="flex flex-col gap-1 text-sm"
            htmlFor="automatic-weekly-plan-renewal"
          >
            <span className="font-medium">Automatic weekly plan renewal</span>
            <span className="text-muted-foreground">
              Create next week as a draft after the current finalized week
              finishes.
            </span>
          </label>
        </div>
      </section>
    </SettingsPageShell>
  );
}
