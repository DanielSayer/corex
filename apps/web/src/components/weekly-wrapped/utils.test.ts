import { describe, expect, it } from "bun:test";

import {
  formatGeneratedAt,
  formatNumericValue,
  formatWeekRange,
} from "./utils";

describe("weekly wrapped utils", () => {
  it("formats stored week boundaries into a local date range", () => {
    expect(
      formatWeekRange("2026-04-05T14:00:00.000Z", "2026-04-12T14:00:00.000Z"),
    ).toContain("Apr");
  });

  it("formats goal values with units and null fallbacks", () => {
    expect(formatNumericValue(30, "km")).toBe("30 km");
    expect(formatNumericValue(21.1, "km")).toBe("21.1 km");
    expect(formatNumericValue(null, "km")).toBe("Snapshot saved");
  });

  it("formats snapshot generation timestamps", () => {
    expect(formatGeneratedAt("2026-04-13T01:00:00.000Z")).toBeTruthy();
  });
});
