import { Button } from "@corex/ui/components/button";
import { Separator } from "@corex/ui/components/separator";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

import type { OnboardingDraft } from "@/lib/onboarding";

import { SummaryRow } from "./shared";

export function SyncStep({
  draft,
  onContinue,
}: {
  draft: OnboardingDraft;
  onContinue: () => void;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex items-center gap-3 text-primary">
        <CheckCircle2Icon />
        <span className="text-sm font-medium">Settings saved</span>
      </div>

      <div className="flex flex-col gap-5">
        <div className="text-sm text-muted-foreground">Summary</div>
        <div className="flex flex-col gap-4 rounded-4xl border border-border bg-card/30 px-6 py-5">
          <SummaryRow
            label="Goal"
            value={
              draft.goal.type === "event_goal" ? "Event goal" : "Volume goal"
            }
          />
          <Separator />
          <SummaryRow
            label="Intervals username"
            value={draft.intervalsUsername}
          />
          <Separator />
          <SummaryRow
            label="Next step"
            value="Manual sync will be wired in a later pass"
          />
        </div>
      </div>

      <Button className="w-fit" onClick={onContinue}>
        Continue to dashboard
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </div>
  );
}
