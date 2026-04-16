import { Data } from "effect";

import type { GenerationFailureCategory } from "./contracts";

export class WeeklyPlanningValidationError extends Data.TaggedError(
  "WeeklyPlanningValidationError",
)<{
  message: string;
}> {}

export class MissingTrainingSettings extends Data.TaggedError(
  "MissingTrainingSettings",
)<{
  message: string;
}> {}

export class MissingGoal extends Data.TaggedError("MissingGoal")<{
  message: string;
}> {}

export class NoLocalHistory extends Data.TaggedError("NoLocalHistory")<{
  message: string;
}> {}

export class MissingPriorPlan extends Data.TaggedError("MissingPriorPlan")<{
  message: string;
}> {}

export class DraftConflict extends Data.TaggedError("DraftConflict")<{
  message: string;
}> {}

export class DraftNotFound extends Data.TaggedError("DraftNotFound")<{
  message: string;
}> {}

export class PlanFinalizationConflict extends Data.TaggedError(
  "PlanFinalizationConflict",
)<{
  message: string;
}> {}

export class InvalidStructuredOutput extends Data.TaggedError(
  "InvalidStructuredOutput",
)<{
  message: string;
}> {}

export class PlanQualityGuardrailFailure extends Data.TaggedError(
  "PlanQualityGuardrailFailure",
)<{
  message: string;
}> {}

export class ProviderFailure extends Data.TaggedError("ProviderFailure")<{
  message: string;
  cause?: unknown;
}> {}

export class GenerationTimeout extends Data.TaggedError("GenerationTimeout")<{
  message: string;
  cause?: unknown;
}> {}

export class WeeklyPlanningPersistenceFailure extends Data.TaggedError(
  "WeeklyPlanningPersistenceFailure",
)<{
  message: string;
  cause?: unknown;
}> {}

export function toFailureCategory(
  error: unknown,
): GenerationFailureCategory | null {
  if (error instanceof MissingTrainingSettings) {
    return "missing_training_settings";
  }

  if (error instanceof MissingGoal) {
    return "missing_goal";
  }

  if (error instanceof NoLocalHistory) {
    return "no_local_history";
  }

  if (error instanceof DraftConflict) {
    return "draft_conflict";
  }

  if (error instanceof ProviderFailure) {
    return "provider_failure";
  }

  if (error instanceof GenerationTimeout) {
    return "generation_timeout";
  }

  if (
    error instanceof InvalidStructuredOutput ||
    error instanceof WeeklyPlanningValidationError
  ) {
    return "invalid_structured_output";
  }

  if (error instanceof PlanQualityGuardrailFailure) {
    return "quality_guardrail_failure";
  }

  return null;
}
