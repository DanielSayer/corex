import { describe, expect, it } from "bun:test";

import {
  buildActivityMetricSeries,
  downsampleActivityMetricPoints,
  downsampleMapLatLngs,
} from "./activity-series";

describe("activity series helpers", () => {
  it("caps metric series while preserving endpoints and local extremes", () => {
    const points = [
      { second: 0, value: 1 },
      { second: 1, value: 4 },
      { second: 2, value: 2 },
      { second: 3, value: 8 },
      { second: 4, value: 3 },
      { second: 5, value: 7 },
      { second: 6, value: 2 },
      { second: 7, value: 6 },
      { second: 8, value: 1 },
    ];

    const result = downsampleActivityMetricPoints(points, 6);

    expect(result).toHaveLength(6);
    expect(result[0]).toEqual(points[0]!);
    expect(result[result.length - 1]).toEqual(points[points.length - 1]!);
    expect(result).toContainEqual(points[3]!);
    expect(result).toContainEqual(points[6]!);
  });

  it("builds chart-ready metric series from raw upstream arrays", () => {
    const result = buildActivityMetricSeries({
      durationSeconds: 240,
      metric: "velocity_smooth",
      rawData: [3.5, 0, 3.8, 4.1],
      maxPoints: 10,
    });

    expect(result).toEqual([
      { second: 0, value: 3.5 },
      { second: 120, value: 3.8 },
      { second: 180, value: 4.1 },
    ]);
  });

  it("caps map previews while preserving the first and last points", () => {
    const latlngs = Array.from({ length: 10 }, (_, index) => [
      -27.4 + index / 100,
      153 + index / 100,
    ]);

    const result = downsampleMapLatLngs(latlngs, 4);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual(latlngs[0]!);
    expect(result[result.length - 1]).toEqual(latlngs[latlngs.length - 1]!);
  });
});
