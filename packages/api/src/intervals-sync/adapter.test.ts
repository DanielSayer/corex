import { describe, expect, it } from "bun:test";

import { createIntervalsAdapter } from "./adapter";

describe("intervals adapter", () => {
  it("encodes repeated stream type query params when requesting activity streams", async () => {
    const requestedUrls: string[] = [];

    const adapter = createIntervalsAdapter({
      baseUrl: "https://intervals.test/api/v1",
      fetch: (async (input) => {
        requestedUrls.push(String(input));

        return new Response(
          JSON.stringify([
            {
              type: "distance",
              data: [0, 1, 2],
            },
          ]),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }) as typeof fetch,
    });

    await adapter.getActivityStreams({
      credentials: {
        username: "runner@example.com",
        apiKey: "secret",
      },
      activityId: "run-1",
      types: ["distance", "heartrate", "cadence"],
    });

    expect(requestedUrls).toHaveLength(1);

    const url = new URL(requestedUrls[0]!);

    expect(url.pathname).toBe("/api/v1/activity/run-1/streams.json");
    expect(url.searchParams.getAll("types")).toEqual([
      "distance",
      "heartrate",
      "cadence",
    ]);
  });
});
