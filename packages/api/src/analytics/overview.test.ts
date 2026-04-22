import { describe, expect, it } from "bun:test";

import {
  buildActiveMonthSummary,
  buildConsistency,
  calculateDeltaPercent,
  getAnalyticsYearContext,
  type AnalyticsOverviewMonthBucket,
} from "./overview";

describe("analytics overview helpers", () => {
  it("uses the current local date as the cutoff for the current year", () => {
    expect(
      getAnalyticsYearContext({
        selectedYear: 2026,
        timezone: "Australia/Brisbane",
        now: new Date("2026-04-22T05:30:00.000Z"),
      }),
    ).toMatchObject({
      cutoffDateKey: "2026-04-22",
      comparisonCutoffDateKey: "2025-04-22",
      comparisonYear: 2025,
      elapsedMonthCount: 4,
      isPartialYear: true,
    });
  });

  it("uses year end cutoffs for past years", () => {
    expect(
      getAnalyticsYearContext({
        selectedYear: 2025,
        timezone: "Australia/Brisbane",
        now: new Date("2026-04-22T05:30:00.000Z"),
      }),
    ).toMatchObject({
      cutoffDateKey: "2025-12-31",
      comparisonCutoffDateKey: "2024-12-31",
      comparisonYear: 2024,
      elapsedMonthCount: 12,
      isPartialYear: false,
    });
  });

  it("marks only elapsed months for the current year and rounds the percent", () => {
    const months: AnalyticsOverviewMonthBucket[] = [
      { key: "2026-01", label: "Jan", distanceMeters: 5000 },
      { key: "2026-02", label: "Feb", distanceMeters: 0 },
      { key: "2026-03", label: "Mar", distanceMeters: 2000 },
      { key: "2026-04", label: "Apr", distanceMeters: 0 },
      { key: "2026-05", label: "May", distanceMeters: 7000 },
      ...Array.from({ length: 7 }, (_, index) => ({
        key: `2026-${String(index + 6).padStart(2, "0")}`,
        label: new Date(
          `2026-${String(index + 6).padStart(2, "0")}-01T00:00:00.000Z`,
        ).toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
        distanceMeters: 0,
      })),
    ];

    expect(
      buildConsistency({
        monthBuckets: months,
        elapsedMonthCount: 4,
      }),
    ).toEqual({
      activeMonthCount: 3,
      elapsedMonthCount: 4,
      ratio: 0.75,
      percent: 75,
      months: [
        { key: "2026-01", label: "Jan", isElapsed: true, isActive: true },
        { key: "2026-02", label: "Feb", isElapsed: true, isActive: false },
        { key: "2026-03", label: "Mar", isElapsed: true, isActive: true },
        { key: "2026-04", label: "Apr", isElapsed: true, isActive: false },
        { key: "2026-05", label: "May", isElapsed: false, isActive: true },
        { key: "2026-06", label: "Jun", isElapsed: false, isActive: false },
        { key: "2026-07", label: "Jul", isElapsed: false, isActive: false },
        { key: "2026-08", label: "Aug", isElapsed: false, isActive: false },
        { key: "2026-09", label: "Sep", isElapsed: false, isActive: false },
        { key: "2026-10", label: "Oct", isElapsed: false, isActive: false },
        { key: "2026-11", label: "Nov", isElapsed: false, isActive: false },
        { key: "2026-12", label: "Dec", isElapsed: false, isActive: false },
      ],
    });
  });

  it("marks all months elapsed for past years", () => {
    expect(
      buildConsistency({
        monthBuckets: [
          { key: "2025-01", label: "Jan", distanceMeters: 1 },
          ...Array.from({ length: 11 }, (_, index) => ({
            key: `2025-${String(index + 2).padStart(2, "0")}`,
            label: new Date(
              `2025-${String(index + 2).padStart(2, "0")}-01T00:00:00.000Z`,
            ).toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
            distanceMeters: 0,
          })),
        ],
        elapsedMonthCount: 12,
      }).months.every((month) => month.isElapsed),
    ).toBe(true);
  });

  it("returns null when the comparison distance is zero", () => {
    expect(
      calculateDeltaPercent({
        currentDistanceMeters: 5000,
        comparisonDistanceMeters: 0,
      }),
    ).toBeNull();
  });

  it("builds the active month summary range label", () => {
    expect(
      buildActiveMonthSummary({
        monthBuckets: [
          { key: "2026-01", label: "Jan", distanceMeters: 5 },
          { key: "2026-02", label: "Feb", distanceMeters: 0 },
          { key: "2026-03", label: "Mar", distanceMeters: 7 },
        ],
        elapsedMonthCount: 3,
      }),
    ).toEqual({
      count: 2,
      elapsedCount: 3,
      rangeLabel: "Jan - Mar",
    });
  });
});
