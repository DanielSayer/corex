import {
  InvalidIntervalsCredentials,
  IntervalsSchemaValidationFailure,
  IntervalsUpstreamFailure,
} from "./errors";
import {
  intervalsActivityDetailSchema,
  intervalsActivityMapSchema,
  intervalsActivityStreamsSchema,
  intervalsAthleteActivitiesSchema,
  intervalsAthleteProfileSchema,
  type IntervalsActivityDetail,
  type IntervalsActivityMap,
  type IntervalsActivityDiscovery,
  type IntervalsActivityStream,
  type IntervalsAthleteProfile,
} from "./schemas";

export type IntervalsIcuCredentials = {
  username: string;
  apiKey: string;
};

export type IntervalsIcuClient = {
  getProfile: (input: {
    credentials: IntervalsIcuCredentials;
  }) => Promise<IntervalsAthleteProfile>;
  listActivities: (input: {
    credentials: IntervalsIcuCredentials;
    athleteId: string;
    oldest: string;
    newest?: string;
  }) => Promise<IntervalsActivityDiscovery[]>;
  getActivityDetail: (input: {
    credentials: IntervalsIcuCredentials;
    activityId: string;
  }) => Promise<IntervalsActivityDetail>;
  getActivityMap: (input: {
    credentials: IntervalsIcuCredentials;
    activityId: string;
  }) => Promise<IntervalsActivityMap | null>;
  getActivityStreams: (input: {
    credentials: IntervalsIcuCredentials;
    activityId: string;
    types: string[];
  }) => Promise<IntervalsActivityStream[]>;
};

type CreateIntervalsIcuClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

function createBasicAuth(credentials: IntervalsIcuCredentials) {
  return `Basic ${Buffer.from(`API_KEY:${credentials.apiKey}`).toString("base64")}`;
}

async function parseResponseJson(
  response: Response,
  endpoint: string,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    throw new IntervalsUpstreamFailure({
      message: "Intervals response was not valid JSON",
      endpoint,
      cause,
    });
  }
}

function assertOkOrThrow(response: Response, endpoint: string): void {
  if (response.status === 401 || response.status === 403) {
    throw new InvalidIntervalsCredentials({
      message: "Intervals credentials were rejected",
      cause: response.status,
    });
  }

  if (!response.ok) {
    throw new IntervalsUpstreamFailure({
      message: `Intervals request failed with status ${response.status}`,
      endpoint,
      cause: response.status,
    });
  }
}

function validatePayload<T>(
  payload: unknown,
  endpoint: string,
  schema: {
    safeParse: (
      value: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: Array<{ message: string }> } };
  },
): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new IntervalsSchemaValidationFailure({
      message:
        result.error.issues[0]?.message ?? "Intervals payload was invalid",
      endpoint,
      cause: result.error,
    });
  }

  return result.data;
}

export function createIntervalsIcuClient(
  options: CreateIntervalsIcuClientOptions = {},
): IntervalsIcuClient {
  const baseUrl = options.baseUrl ?? "https://intervals.icu/api/v1";
  const fetchImpl = options.fetch ?? fetch;

  async function requestJson(
    endpoint: string,
    credentials: IntervalsIcuCredentials,
  ): Promise<unknown> {
    const response = await fetchImpl(`${baseUrl}${endpoint}`, {
      headers: {
        Authorization: createBasicAuth(credentials),
        "Content-Type": "application/json",
      },
    });

    assertOkOrThrow(response, endpoint);
    return parseResponseJson(response, endpoint);
  }

  return {
    async getProfile({ credentials }) {
      // Intervals.icu uses athlete 0 to resolve the authenticated account.
      const endpoint = `/athlete/0`;
      const payload = await requestJson(endpoint, credentials);
      return validatePayload(payload, endpoint, intervalsAthleteProfileSchema);
    },
    async listActivities({ credentials, athleteId, oldest, newest }) {
      const url = new URL(`${baseUrl}/athlete/${athleteId}/activities`);
      url.searchParams.set("oldest", oldest);

      if (newest) {
        url.searchParams.set("newest", newest);
      }

      const response = await fetchImpl(url, {
        headers: {
          Authorization: createBasicAuth(credentials),
          "Content-Type": "application/json",
        },
      });

      assertOkOrThrow(response, `/athlete/${athleteId}/activities`);
      const payload = await parseResponseJson(
        response,
        `/athlete/${athleteId}/activities`,
      );

      return validatePayload(
        payload,
        `/athlete/${athleteId}/activities`,
        intervalsAthleteActivitiesSchema,
      );
    },
    async getActivityDetail({ credentials, activityId }) {
      const endpoint = `/activity/${activityId}?intervals=true`;
      const payload = await requestJson(endpoint, credentials);
      return validatePayload(payload, endpoint, intervalsActivityDetailSchema);
    },
    async getActivityMap({ credentials, activityId }) {
      const endpoint = `/activity/${activityId}/map`;
      const payload = await requestJson(endpoint, credentials);
      return validatePayload(payload, endpoint, intervalsActivityMapSchema);
    },
    async getActivityStreams({ credentials, activityId, types }) {
      const url = new URL(`${baseUrl}/activity/${activityId}/streams.json`);

      for (const type of types) {
        url.searchParams.append("types", type);
      }

      const response = await fetchImpl(url, {
        headers: {
          Authorization: createBasicAuth(credentials),
          "Content-Type": "application/json",
        },
      });

      assertOkOrThrow(response, `/activity/${activityId}/streams.json`);
      const payload = await parseResponseJson(
        response,
        `/activity/${activityId}/streams.json`,
      );

      return validatePayload(
        payload,
        `/activity/${activityId}/streams.json`,
        intervalsActivityStreamsSchema,
      );
    },
  };
}
