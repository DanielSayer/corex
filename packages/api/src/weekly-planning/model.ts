import { Effect } from "effect";

import type { DraftGenerationContext, WeeklyPlanPayload } from "./contracts";
import { GenerationTimeout, ProviderFailure } from "./errors";

export type PlannerModelPort = {
  provider: string;
  model: string;
  generateWeeklyPlan: (
    context: DraftGenerationContext,
  ) => Effect.Effect<WeeklyPlanPayload, ProviderFailure | GenerationTimeout>;
};
