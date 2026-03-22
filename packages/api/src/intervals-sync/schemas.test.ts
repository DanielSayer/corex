import { describe, expect, it } from "bun:test";

import {
  intervalsActivityDetailSchema,
  intervalsActivityMapSchema,
  intervalsActivityStreamsSchema,
  intervalsAthleteActivitiesSchema,
  intervalsAthleteProfileSchema,
} from "./schemas";

describe("intervals schemas", () => {
  it("accepts valid athlete profile payloads", () => {
    const result = intervalsAthleteProfileSchema.safeParse({
      id: "i509216",
      email: "runner@example.com",
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed athlete activities payloads", () => {
    const result = intervalsAthleteActivitiesSchema.safeParse([
      {
        id: 123,
        type: "Run",
      },
    ]);

    expect(result.success).toBe(false);
  });

  it("accepts valid activity detail payloads", () => {
    const result = intervalsActivityDetailSchema.safeParse({
      id: "987654321",
      icu_athlete_id: "i509216",
      type: "Run",
      start_date: "2026-02-18T20:15:00.000+00:00",
      distance: 10032.4,
      moving_time: 2820,
      elapsed_time: 2892,
      average_heartrate: 154,
      icu_intervals: [
        {
          id: 1,
          type: "WARMUP",
          moving_time: 420,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts valid activity map payloads and null map payloads", () => {
    const mapResult = intervalsActivityMapSchema.safeParse({
      latlngs: [
        [-27.47, 153.02],
        [-27.46, 153.03],
      ],
      route: {
        name: "River loop",
      },
      weather: {
        points: [],
        closest_points: [],
      },
    });
    const nullResult = intervalsActivityMapSchema.safeParse(null);

    expect(mapResult.success).toBe(true);
    expect(nullResult.success).toBe(true);
  });

  it("accepts valid activity streams payloads", () => {
    const result = intervalsActivityStreamsSchema.safeParse([
      {
        type: "distance",
        data: [0, 12.4, 24.8],
        allNull: false,
      },
      {
        type: "heartrate",
        data: [118, 121, 125],
      },
    ]);

    expect(result.success).toBe(true);
  });
});
