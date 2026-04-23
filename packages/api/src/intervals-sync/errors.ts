import { Data } from "effect";

export {
  InvalidIntervalsCredentials,
  IntervalsSchemaValidationFailure,
  IntervalsUpstreamFailure,
} from "../integrations/intervals-icu/errors";
import type {
  InvalidIntervalsCredentials,
  IntervalsSchemaValidationFailure,
  IntervalsUpstreamFailure,
} from "../integrations/intervals-icu/errors";

export class MissingIntervalsCredentials extends Data.TaggedError(
  "MissingIntervalsCredentials",
)<{
  message: string;
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
