import {
  InvalidIntervalsCredentials,
  IntervalsSchemaValidationFailure,
  IntervalsUpstreamFailure,
} from "./errors";
import {
  intervalsActivityDetailSchema,
  intervalsAthleteActivitiesSchema,
  intervalsAthleteProfileSchema,
  type IntervalsActivityDetail,
  type IntervalsActivityDiscovery,
  type IntervalsAthleteProfile,
} from "./schemas";

export type IntervalsCredentials = {
  username: string;
  apiKey: string;
};

export type IntervalsAdapter = {
  getProfile: (
    credentials: IntervalsCredentials,
  ) => Promise<IntervalsAthleteProfile>;
  listActivities: (input: {
    credentials: IntervalsCredentials;
    athleteId: string;
    oldest: string;
    newest?: string;
  }) => Promise<IntervalsActivityDiscovery[]>;
  getActivityDetail: (input: {
    credentials: IntervalsCredentials;
    activityId: string;
  }) => Promise<IntervalsActivityDetail>;
};

type CreateIntervalsAdapterOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
};

function createBasicAuth(credentials: IntervalsCredentials) {
  return `Basic ${Buffer.from(`${credentials.username}:${credentials.apiKey}`).toString("base64")}`;
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
    safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } };
  },
): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new IntervalsSchemaValidationFailure({
      message: result.error.issues[0]?.message ?? "Intervals payload was invalid",
      endpoint,
      cause: result.error,
    });
  }

  return result.data;
}

export function createIntervalsAdapter(
  options: CreateIntervalsAdapterOptions = {},
): IntervalsAdapter {
  const baseUrl = options.baseUrl ?? "https://intervals.icu/api/v1";
  const fetchImpl = options.fetch ?? fetch;

  async function requestJson(
    endpoint: string,
    credentials: IntervalsCredentials,
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
    async getProfile(credentials) {
      const endpoint = `/athlete/${credentials.username}`;
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
  };
}
