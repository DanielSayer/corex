import { describe, expect, it } from "bun:test";

import {
  EMPTY_VALUE,
  formatDateTime,
  formatDistanceToKm,
  formatPace,
  formatPaceSecondsPerKm,
  formatSecondsToHms,
  formatSecondsToMinsPerKm,
  formatSpeedToKmPerHour,
  formatSpeedToMinsPerKm,
} from "./formatters";

describe("activity formatters", () => {
  it("returns defaults for empty values", () => {
    expect(formatDistanceToKm(null)).toBe(EMPTY_VALUE);
    expect(formatSpeedToMinsPerKm(null)).toBe(EMPTY_VALUE);
    expect(formatSpeedToKmPerHour(null)).toBe(EMPTY_VALUE);
    expect(formatSecondsToMinsPerKm(null)).toBe(EMPTY_VALUE);
    expect(formatSecondsToHms(null)).toBe(EMPTY_VALUE);
    expect(formatPace(0, 0)).toBe(EMPTY_VALUE);
  });

  it("formats distance and speed values", () => {
    expect(formatDistanceToKm(5000)).toBe("5.00 km");
    expect(formatDistanceToKm(5000, { showUnit: false })).toBe("5.00");
    expect(formatSpeedToKmPerHour(4.5)).toBe("16.20 km/h");
    expect(formatSpeedToMinsPerKm(4)).toBe("4:10");
  });

  it("formats durations and pace values", () => {
    expect(formatSecondsToHms(3723)).toBe("1:02:03");
    expect(formatSecondsToHms(83)).toBe("1:23");
    expect(
      formatSecondsToHms(3960, { showSeconds: false, showUnit: true }),
    ).toBe("1 hr 06 min");
    expect(formatSecondsToHms(66, { showUnit: true })).toBe("1 min 06 s");
    expect(formatSecondsToMinsPerKm(245)).toBe("4:05/km");
    expect(formatPace(5000, 1200)).toBe("4:00/km");
  });

  it("carries rounded pace seconds into the next minute", () => {
    expect(formatPaceSecondsPerKm(299.6)).toBe("5:00/km");
    expect(formatPaceSecondsPerKm(299.6, { showUnit: false })).toBe("5:00");
    expect(formatSecondsToMinsPerKm(299.6)).toBe("5:00/km");
    expect(formatSpeedToMinsPerKm(1000 / 299.6)).toBe("5:00");
    expect(formatPace(1000, 299.6)).toBe("5:00/km");
  });

  it("carries rounded duration seconds into the next minute", () => {
    expect(formatSecondsToHms(59.6)).toBe("1:00");
    expect(formatSecondsToHms(3599.6)).toBe("1:00:00");
  });

  it("formats valid dates and guards invalid dates", () => {
    const value = "2026-03-20T00:00:00.000Z";

    expect(formatDateTime(value)).toBe(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value)),
    );
    expect(formatDateTime("not-a-date")).toBe("Unknown date");
    expect(formatDateTime(null)).toBe("Unknown date");
  });
});
