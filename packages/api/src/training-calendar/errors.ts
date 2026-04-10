import { Data } from "effect";

export class TrainingCalendarPersistenceFailure extends Data.TaggedError(
  "TrainingCalendarPersistenceFailure",
)<{
  message: string;
  cause?: unknown;
}> {}

export class MissingActiveDraft extends Data.TaggedError("MissingActiveDraft")<{
  message: string;
}> {}

export class InvalidTrainingCalendarLink extends Data.TaggedError(
  "InvalidTrainingCalendarLink",
)<{
  message: string;
}> {}

export class TrainingCalendarLinkConflict extends Data.TaggedError(
  "TrainingCalendarLinkConflict",
)<{
  message: string;
}> {}
