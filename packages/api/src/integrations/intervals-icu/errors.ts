import { Data } from "effect";

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
