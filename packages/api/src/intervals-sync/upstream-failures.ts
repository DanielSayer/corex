import {
  InvalidIntervalsCredentials,
  IntervalsSchemaValidationFailure,
  IntervalsUpstreamFailure,
  MissingIntervalsCredentials,
  SyncAlreadyInProgress,
} from "./errors";
import type { IntervalsActivityStream } from "../integrations/intervals-icu/schemas";

export function mapFailureCategory(error: unknown): string {
  if (error instanceof MissingIntervalsCredentials) {
    return "missing_credentials";
  }

  if (error instanceof InvalidIntervalsCredentials) {
    return "invalid_credentials";
  }

  if (error instanceof IntervalsUpstreamFailure) {
    return "upstream_request_failure";
  }

  if (error instanceof IntervalsSchemaValidationFailure) {
    return "upstream_schema_validation_failure";
  }

  if (error instanceof SyncAlreadyInProgress) {
    return "sync_already_in_progress";
  }

  return "persistence_failure";
}

export function createEndpointFailure(
  endpoint: "map" | "streams",
  activityId: string,
  cause: unknown,
) {
  if (
    cause instanceof InvalidIntervalsCredentials ||
    cause instanceof IntervalsUpstreamFailure ||
    cause instanceof IntervalsSchemaValidationFailure
  ) {
    return cause;
  }

  return new IntervalsUpstreamFailure({
    message: `Failed to load Intervals activity ${endpoint} for ${activityId}`,
    endpoint: `${endpoint}:${activityId}`,
    cause,
  });
}

export function validateRequestedStreams(
  activityId: string,
  streams: IntervalsActivityStream[],
  requestedStreamTypes: readonly string[],
): IntervalsActivityStream[] {
  const received = new Set(streams.map((stream) => stream.type));

  for (const type of requestedStreamTypes) {
    if (!received.has(type)) {
      throw new IntervalsSchemaValidationFailure({
        message: `Intervals streams payload for ${activityId} was missing required stream ${type}`,
        endpoint: `streams:${activityId}`,
      });
    }
  }

  return streams.filter((stream) => requestedStreamTypes.includes(stream.type));
}
