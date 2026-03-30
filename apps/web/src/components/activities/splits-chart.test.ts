import { describe, expect, it } from "bun:test";

import { buildSplitChartRows } from "./splits-chart";

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
});
