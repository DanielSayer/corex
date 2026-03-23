import { Button } from "@corex/ui/components/button";
import { Separator } from "@corex/ui/components/separator";
import { CheckCircle2Icon, RefreshCwIcon } from "lucide-react";

import type { OnboardingDraft } from "@/lib/onboarding";

import { SummaryRow } from "./shared";

function formatGoalSummary(draft: OnboardingDraft["goal"]) {
  if (draft.type === "event_goal") {
    const eventName = draft.eventName.trim();
    const distance = `${draft.targetDistanceValue} ${draft.targetDistanceUnit}`;
    return eventName.length > 0
      ? `${eventName} on ${draft.targetDate} · ${distance}`
      : `${distance} event on ${draft.targetDate}`;
  }

  const unit = draft.metric === "time" ? "minutes" : draft.unit;
  return `${draft.targetValue} ${unit} per ${draft.period}`;
}

function formatGoalType(draft: OnboardingDraft["goal"]) {
  return draft.type === "event_goal" ? "Event goal" : "Volume goal";
}

export function SyncStep({ draft }: { draft: OnboardingDraft }) {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex items-center gap-3 text-primary">
        <CheckCircle2Icon />
        <span className="text-sm font-medium">Settings saved</span>
      </div>

      <div className="flex flex-col gap-5">
        <div className="text-sm text-muted-foreground">Summary</div>
        <div className="flex flex-col gap-4 rounded-4xl border border-border bg-card/30 px-6 py-5">
          <SummaryRow label="Goal type" value={formatGoalType(draft.goal)} />
          <Separator />
          <SummaryRow
            label="Goal target"
            value={formatGoalSummary(draft.goal)}
          />
          <Separator />
          <SummaryRow
            label="Intervals username"
            value={draft.intervalsUsername}
          />
          <Separator />
          <SummaryRow
            label="Next step"
            value="Pull your recent activities from Intervals"
          />
        </div>
      </div>

      <Button className="w-fit" type="button">
        <RefreshCwIcon data-icon="inline-start" />
        Get activities from Intervals
      </Button>
    </div>
  );
}
