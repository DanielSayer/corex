import { describe, expect, it } from "bun:test";

import {
  aggregateTerrainSummary,
  deriveTerrainClass,
  deriveTerrainRun,
} from "./domain";

describe("terrain domain", () => {
  it("classifies runs by elevation gain density", () => {
    expect(
      deriveTerrainClass({
        distanceMeters: 1000,
        elevationGainMeters: 4.9,
      }),
    ).toBe("flat");
    expect(
      deriveTerrainClass({
        distanceMeters: 1000,
        elevationGainMeters: 5,
      }),
    ).toBe("rolling");
    expect(
      deriveTerrainClass({
        distanceMeters: 1000,
        elevationGainMeters: 15,
      }),
    ).toBe("rolling");
    expect(
      deriveTerrainClass({
        distanceMeters: 1000,
        elevationGainMeters: 15.1,
      }),
    ).toBe("hilly");
  });

  it("leaves invalid or missing terrain inputs unclassified", () => {
    expect(
      deriveTerrainRun({
        distanceMeters: null,
        elevationGainMeters: 10,
      }),
    ).toEqual({
      terrainClass: null,
      elevationGainMetersPerKm: null,
    });
    expect(
      deriveTerrainRun({
        distanceMeters: 0,
        elevationGainMeters: 10,
      }),
    ).toEqual({
      terrainClass: null,
      elevationGainMetersPerKm: null,
    });
    expect(
      deriveTerrainRun({
        distanceMeters: 1000,
        elevationGainMeters: null,
      }),
    ).toEqual({
      terrainClass: null,
      elevationGainMetersPerKm: null,
    });
    expect(
      deriveTerrainRun({
        distanceMeters: 1000,
        elevationGainMeters: -1,
      }),
    ).toEqual({
      terrainClass: null,
      elevationGainMetersPerKm: null,
    });
    expect(
      deriveTerrainRun({
        distanceMeters: Number.POSITIVE_INFINITY,
        elevationGainMeters: 10,
      }),
    ).toEqual({
      terrainClass: null,
      elevationGainMetersPerKm: null,
    });
  });

  it("aggregates stable terrain summary buckets", () => {
    const summary = aggregateTerrainSummary([
      { distanceMeters: 10_000, elevationGainMeters: 40 },
      { distanceMeters: 10_000, elevationGainMeters: 50 },
      { distanceMeters: 8_000, elevationGainMeters: 80 },
      { distanceMeters: 5_000, elevationGainMeters: 100 },
      { distanceMeters: 6_000, elevationGainMeters: null },
    ]);

    expect(summary.totalRunCount).toBe(5);
    expect(summary.classifiedRunCount).toBe(4);
    expect(summary.unclassifiedRunCount).toBe(1);
    expect(summary.classifiedDistanceMeters).toBe(33_000);
    expect(summary.classifiedElevationGainMeters).toBe(270);
    expect(summary.averageElevationGainMetersPerKm).toBeCloseTo(8.18, 2);
    expect(summary.dominantClass).toBe("rolling");
    expect(summary.classes).toEqual([
      {
        terrainClass: "flat",
        runCount: 1,
        distanceMeters: 10_000,
        elevationGainMeters: 40,
        averageElevationGainMetersPerKm: 4,
      },
      {
        terrainClass: "rolling",
        runCount: 2,
        distanceMeters: 18_000,
        elevationGainMeters: 130,
        averageElevationGainMetersPerKm: 7.222222222222222,
      },
      {
        terrainClass: "hilly",
        runCount: 1,
        distanceMeters: 5_000,
        elevationGainMeters: 100,
        averageElevationGainMetersPerKm: 20,
      },
    ]);
  });
});
