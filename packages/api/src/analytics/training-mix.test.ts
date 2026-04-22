import { describe, expect, it } from "bun:test";

import {
  classifyTrainingMixActivity,
  summarizeTrainingMix,
} from "./training-mix";

describe("analytics training mix", () => {
  it("prefers tempo labels over long run wording", () => {
    expect(
      classifyTrainingMixActivity({
        name: "Tempo long run combo",
        intervalSummary: ["Long run with tempo finish"],
        workIntervalCount: 0,
      }),
    ).toBe("tempo");
  });

  it("classifies activities with multiple work intervals as intervals", () => {
    expect(
      classifyTrainingMixActivity({
        name: "Morning workout",
        intervalSummary: null,
        workIntervalCount: 2,
      }),
    ).toBe("intervals");
  });

  it("classifies explicit long runs", () => {
    expect(
      classifyTrainingMixActivity({
        name: "Sunday long run",
        intervalSummary: null,
        workIntervalCount: 0,
      }),
    ).toBe("long_run");
  });

  it("falls back to easy when metadata is ambiguous", () => {
    expect(
      classifyTrainingMixActivity({
        name: "Morning progression",
        intervalSummary: ["steady aerobic work"],
        workIntervalCount: 0,
      }),
    ).toBe("easy");
  });

  it("does not infer non-easy types without explicit metadata", () => {
    expect(
      classifyTrainingMixActivity({
        name: "Hard day",
        intervalSummary: ["high intensity"],
        workIntervalCount: 0,
      }),
    ).toBe("easy");
  });

  it("computes bucket totals and shares across all run buckets", () => {
    expect(
      summarizeTrainingMix([
        {
          key: "tempo",
          distanceMeters: 5000,
        },
        {
          key: "intervals",
          distanceMeters: 3000,
        },
        {
          key: "easy",
          distanceMeters: 2000,
        },
      ]),
    ).toEqual({
      totalDistanceMeters: 10000,
      buckets: [
        {
          key: "easy",
          distanceMeters: 2000,
          runCount: 1,
          sharePercent: 20,
        },
        {
          key: "long_run",
          distanceMeters: 0,
          runCount: 0,
          sharePercent: 0,
        },
        {
          key: "tempo",
          distanceMeters: 5000,
          runCount: 1,
          sharePercent: 50,
        },
        {
          key: "intervals",
          distanceMeters: 3000,
          runCount: 1,
          sharePercent: 30,
        },
      ],
    });
  });
});
