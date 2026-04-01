import { describe, expect, it } from "bun:test";

import {
  buildActivityCalendar,
  calculateAveragePaceSecondsPerKm,
} from "./activity-calendar";

describe("activity history calendar", () => {
  it("calculates per-activity pace from elapsed time and distance", () => {
    expect(calculateAveragePaceSecondsPerKm(1500, 5000)).toBe(300);
    expect(calculateAveragePaceSecondsPerKm(null, 5000)).toBeNull();
    expect(calculateAveragePaceSecondsPerKm(1500, 0)).toBeNull();
  });

  it("builds activities and monday-based weekly summaries for a timezone-aware range", () => {
    const result = buildActivityCalendar(
      {
        from: "2026-03-30T00:00:00.000Z",
        to: "2026-04-13T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      },
      [
        {
          id: "run-1",
          name: "Morning run",
          startDate: new Date("2026-03-30T22:30:00.000Z"),
          elapsedTime: 1500,
          distance: 5000,
          averageHeartrate: 150,
          trainingLoad: 42,
          totalElevationGain: 30,
        },
        {
          id: "run-2",
          name: null,
          startDate: new Date("2026-04-05T23:30:00.000Z"),
          elapsedTime: null,
          distance: 4000,
          averageHeartrate: null,
          trainingLoad: null,
          totalElevationGain: 15,
        },
      ],
    );

    expect(result.activities).toEqual([
      {
        id: "run-1",
        name: "Morning run",
        startDate: "2026-03-30T22:30:00.000Z",
        elapsedTime: 1500,
        distance: 5000,
        averagePaceSecondsPerKm: 300,
        averageHeartrate: 150,
        trainingLoad: 42,
        totalElevationGain: 30,
      },
      {
        id: "run-2",
        name: "Untitled run",
        startDate: "2026-04-05T23:30:00.000Z",
        elapsedTime: null,
        distance: 4000,
        averagePaceSecondsPerKm: null,
        averageHeartrate: null,
        trainingLoad: null,
        totalElevationGain: 15,
      },
    ]);
    expect(result.weeks).toEqual([
      {
        weekStart: "2026-03-30",
        weekEnd: "2026-04-05",
        time: 1500,
        distance: 5000,
        totalElevationGain: 30,
        averagePaceSecondsPerKm: 300,
      },
      {
        weekStart: "2026-04-06",
        weekEnd: "2026-04-12",
        time: 0,
        distance: 4000,
        totalElevationGain: 15,
        averagePaceSecondsPerKm: null,
      },
      {
        weekStart: "2026-04-13",
        weekEnd: "2026-04-19",
        time: 0,
        distance: 0,
        totalElevationGain: 0,
        averagePaceSecondsPerKm: null,
      },
    ]);
  });

  it("includes empty weeks and excludes the exclusive upper boundary", () => {
    const result = buildActivityCalendar(
      {
        from: "2026-03-30T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
        timezone: "UTC",
      },
      [
        {
          id: "run-1",
          name: "Boundary run",
          startDate: new Date("2026-04-19T23:59:59.000Z"),
          elapsedTime: 1800,
          distance: 6000,
          averageHeartrate: 155,
          trainingLoad: 50,
          totalElevationGain: null,
        },
      ],
    );

    expect(result.weeks).toEqual([
      expect.objectContaining({
        weekStart: "2026-03-30",
        weekEnd: "2026-04-05",
      }),
      expect.objectContaining({
        weekStart: "2026-04-06",
        weekEnd: "2026-04-12",
        time: 0,
        distance: 0,
        totalElevationGain: 0,
        averagePaceSecondsPerKm: null,
      }),
      expect.objectContaining({
        weekStart: "2026-04-13",
        weekEnd: "2026-04-19",
        time: 1800,
        distance: 6000,
        totalElevationGain: 0,
        averagePaceSecondsPerKm: 300,
      }),
    ]);
  });
});
