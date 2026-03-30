import { describe, expect, it } from "bun:test";

import { getZonePercentage } from "./hr-zone-chart";

describe("getZonePercentage", () => {
  it("returns the share of total time for a zone", () => {
    expect(getZonePercentage(484, 1434)).toBeCloseTo(33.7517, 3);
    expect(getZonePercentage(271, 1434)).toBeCloseTo(18.8982, 3);
    expect(getZonePercentage(0, 1434)).toBe(0);
  });

  it("guards zero total time", () => {
    expect(getZonePercentage(10, 0)).toBe(0);
  });
});
