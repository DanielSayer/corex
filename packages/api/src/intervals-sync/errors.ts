import { Data } from "effect";

export class MissingIntervalsCredentials extends Data.TaggedError(
  "MissingIntervalsCredentials",
)<{
  message: string;
}> {}

export class InvalidIntervalsCredentials extends Data.TaggedError(
  "InvalidIntervalsCredentials",
)<{
  message: string;
  cause?: unknown;
}> {}

export class IntervalsUpstreamFailure extends Data.TaggedError(
  "IntervalsUpstreamFailure",
)<{
  message: string;
  endpoint: string;
  cause?: unknown;
}> {}

export class IntervalsSchemaValidationFailure extends Data.TaggedError(
  "IntervalsSchemaValidationFailure",
)<{
  message: string;
  endpoint: string;
  cause?: unknown;
}> {}

export class SyncAlreadyInProgress extends Data.TaggedError(
  "SyncAlreadyInProgress",
)<{
  message: string;
}> {}

export class SyncPersistenceFailure extends Data.TaggedError(
  "SyncPersistenceFailure",
)<{
  message: string;
  cause?: unknown;
}> {}

export type IntervalsSyncError =
  | MissingIntervalsCredentials
  | InvalidIntervalsCredentials
  | IntervalsUpstreamFailure
  | IntervalsSchemaValidationFailure
  | SyncAlreadyInProgress
  | SyncPersistenceFailure;
