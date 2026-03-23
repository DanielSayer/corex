import { Skeleton } from "@corex/ui/components/skeleton";

import { onboardingSteps } from "@/lib/onboarding";

export function StepHeader({
  currentStepIndex,
  content,
}: {
  currentStepIndex: number;
  content: { eyebrow: string; title: string; description: string };
}) {
  return (
    <header className="flex flex-col gap-6">
      <ProgressHeader currentStepIndex={currentStepIndex} />
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
          {content.eyebrow}
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="max-w-2xl text-4xl leading-tight font-semibold tracking-tight">
            {content.title}
          </h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            {content.description}
          </p>
        </div>
      </div>
    </header>
  );
}

function ProgressHeader({ currentStepIndex }: { currentStepIndex: number }) {
  const progress = ((currentStepIndex + 1) / onboardingSteps.length) * 100;

  return (
    <div className="flex items-center justify-between gap-8">
      <div className="h-px w-full max-w-64 bg-border">
        <div
          className="h-px bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {currentStepIndex + 1} of {onboardingSteps.length}
      </p>
    </div>
  );
}

export function OnboardingSkeleton() {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl px-8 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-12 w-2xl" />
          <Skeleton className="h-6 w-xl" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-80" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </main>
  );
}
