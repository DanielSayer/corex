import { describe, expect, it } from "bun:test";

import {
  TARGET_EFFORT_DISTANCES_METERS,
  computeBestEfforts,
  isMonotonicDistanceStream,
  normalizeDistanceStreamData,
  normalizeMonthStart,
  selectAllTimePr,
  selectMonthlyPrs,
  validateDistanceStreamSampleCount,
} from "./derived-performance";

describe("derived performance", () => {
  it("normalizes only numeric array distance streams", () => {
    expect(normalizeDistanceStreamData([0, 1, 2])).toEqual([0, 1, 2]);
    expect(normalizeDistanceStreamData({ data: [0, 1, 2] })).toBeNull();
    expect(normalizeDistanceStreamData([0, "1", 2])).toBeNull();
  });

  it("accepts any non-trivial sample count once the stream is structurally valid", () => {
    expect(validateDistanceStreamSampleCount(3600, 3600)).toBe(true);
    expect(validateDistanceStreamSampleCount(3599, 3600)).toBe(true);
    expect(validateDistanceStreamSampleCount(3500, 3600)).toBe(true);
    expect(validateDistanceStreamSampleCount(3601, 3600)).toBe(true);
    expect(validateDistanceStreamSampleCount(4200, 3600)).toBe(true);
    expect(validateDistanceStreamSampleCount(1, 3600)).toBe(false);
  });

  it("requires a monotonic cumulative distance stream", () => {
    expect(isMonotonicDistanceStream([0, 1, 1, 2])).toBe(true);
    expect(isMonotonicDistanceStream([0, 2, 1])).toBe(false);
  });

  it("computes interpolated best efforts for reachable targets", () => {
    const samples = Array.from({ length: 2401 }, (_, second) => second * 5);

    const efforts = computeBestEfforts(samples);

    expect(efforts).toHaveLength(5);
    expect(efforts[0]).toMatchObject({
      distanceMeters: 400,
      durationSeconds: 80,
      startSampleIndex: 0,
    });
    expect(efforts[1]).toMatchObject({
      distanceMeters: 1000,
      durationSeconds: 200,
      startSampleIndex: 0,
    });
    expect(efforts[2]).toMatchObject({
      distanceMeters: 1609.344,
      durationSeconds: 321.8688,
      startSampleIndex: 0,
    });
    expect(efforts.some((effort) => effort.distanceMeters === 21097.5)).toBe(
      false,
    );
    expect(efforts.some((effort) => effort.distanceMeters === 42195)).toBe(
      false,
    );
  });

  it("keeps repeated-distance pause segments inside the elapsed effort time", () => {
    const samples = [
      0, 100, 200, 300, 400, 500, 500, 500, 500, 600, 700, 800, 900, 1000,
    ];

    const efforts = computeBestEfforts(samples);
    const kilometre = efforts.find((effort) => effort.distanceMeters === 1000);

    expect(kilometre).toMatchObject({
      durationSeconds: 13,
      startSampleIndex: 0,
      endSampleIndex: 13,
    });
  });

  it("prefers the earliest run when PR times tie", () => {
    const earlier = {
      userId: "user-1",
      upstreamActivityId: "run-1",
      distanceMeters: 5000,
      durationSeconds: 1200,
      startSampleIndex: 0,
      endSampleIndex: 1200,
      startAt: new Date("2026-01-05T00:00:00.000Z"),
    };
    const later = {
      ...earlier,
      upstreamActivityId: "run-2",
      startAt: new Date("2026-02-05T00:00:00.000Z"),
    };

    expect(selectAllTimePr([later, earlier])).toEqual(earlier);
  });

  it("selects month-only bests independently per month", () => {
    const januarySlow = {
      userId: "user-1",
      upstreamActivityId: "run-1",
      distanceMeters: 5000,
      durationSeconds: 1220,
      startSampleIndex: 0,
      endSampleIndex: 1220,
      startAt: new Date("2026-01-10T00:00:00.000Z"),
    };
    const januaryFast = {
      ...januarySlow,
      upstreamActivityId: "run-2",
      durationSeconds: 1200,
      startAt: new Date("2026-01-12T00:00:00.000Z"),
    };
    const february = {
      ...januarySlow,
      upstreamActivityId: "run-3",
      durationSeconds: 1210,
      startAt: new Date("2026-02-03T00:00:00.000Z"),
    };

    const winners = selectMonthlyPrs([januarySlow, januaryFast, february]);

    expect([...winners.keys()]).toEqual([
      normalizeMonthStart(new Date("2026-01-01T00:00:00.000Z")).toISOString(),
      normalizeMonthStart(new Date("2026-02-01T00:00:00.000Z")).toISOString(),
    ]);
    expect(winners.get("2026-01-01T00:00:00.000Z")).toEqual(januaryFast);
    expect(winners.get("2026-02-01T00:00:00.000Z")).toEqual(february);
  });

  it("exports the official target effort distances", () => {
    expect(TARGET_EFFORT_DISTANCES_METERS).toEqual([
      400, 1000, 1609.344, 5000, 10000, 21097.5, 42195,
    ]);
  });
});
