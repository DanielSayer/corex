export class PlanAdherenceValidationError extends Error {
  override readonly name = "PlanAdherenceValidationError";
}

export class PlanAdherencePlanNotFound extends Error {
  override readonly name = "PlanAdherencePlanNotFound";
}

export class PlanAdherencePersistenceFailure extends Error {
  override readonly name = "PlanAdherencePersistenceFailure";
}
