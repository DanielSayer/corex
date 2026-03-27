import { CheckCircle2Icon } from "lucide-react";

import { Input } from "@corex/ui/components/input";

import type { OnboardingDraft, StepErrors } from "@/lib/onboarding";

import { FieldBlock, FieldError } from "./shared";

export function CredentialsStep({
  draft,
  errors,
  isSaving,
  onUsernameChange,
  onApiKeyChange,
}: {
  draft: OnboardingDraft;
  errors: StepErrors;
  isSaving: boolean;
  onUsernameChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <FieldBlock label="Intervals username" error={errors.intervalsUsername}>
        <Input
          value={draft.intervalsUsername}
          aria-invalid={Boolean(errors.intervalsUsername)}
          onChange={(event) => onUsernameChange(event.target.value)}
        />
      </FieldBlock>

      <FieldBlock label="Intervals API key" error={errors.intervalsApiKey}>
        <Input
          type="password"
          value={draft.intervalsApiKey}
          aria-invalid={Boolean(errors.intervalsApiKey)}
          onChange={(event) => onApiKeyChange(event.target.value)}
        />
      </FieldBlock>

      <div className="flex flex-col gap-3 border-l border-border/70 pl-5">
        <div className="flex items-center gap-3 text-sm font-medium tracking-tight">
          <CheckCircle2Icon />
          Save once, sync later
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          This step only stores credentials. The first sync remains a stub for
          now.
        </p>
        {isSaving ? (
          <p className="text-sm text-muted-foreground">
            Saving your settings now.
          </p>
        ) : null}
      </div>

      <FieldError error={errors.credentials} />
    </div>
  );
}
