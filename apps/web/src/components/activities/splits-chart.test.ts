import { describe, expect, it } from "bun:test";

import { buildSplitChartRows, formatDiff } from "./splits-chart";

describe("buildSplitChartRows", () => {
  it("derives per-split pace from cumulative split distances", () => {
    expect(
      buildSplitChartRows([
        {
          splitNumber: 1,
          splitDistanceMeters: 1000,
          durationSeconds: 281,
        },
        {
          splitNumber: 2,
          splitDistanceMeters: 2000,
          durationSeconds: 283,
        },
        {
          splitNumber: 3,
          splitDistanceMeters: 3000,
          durationSeconds: 289,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        splitNumber: 1,
        distanceKm: 1,
        paceSecondsPerKm: 281,
      }),
      expect.objectContaining({
        splitNumber: 2,
        distanceKm: 1,
        paceSecondsPerKm: 283,
      }),
      expect.objectContaining({
        splitNumber: 3,
        distanceKm: 1,
        paceSecondsPerKm: 289,
      }),
    ]);
  });

  it("carries rounded diff seconds into the next minute", () => {
    expect(formatDiff(59.6)).toBe("+1:00");
    expect(formatDiff(-59.6)).toBe("-1:00");
  });
});
