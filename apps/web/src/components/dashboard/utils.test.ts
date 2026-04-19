import { describe, expect, it } from "bun:test";

import {
  formatDistance,
  formatDuration,
  formatHeartRate,
  formatPace,
  toSvgPath,
} from "./utils";

describe("dashboard activity utils", () => {
  it("returns null svg path when fewer than two valid points exist", () => {
    expect(toSvgPath([[1, 2]])).toBeNull();
    expect(toSvgPath([null, [1]])).toBeNull();
  });

  it("builds an svg path when at least two valid points exist", () => {
    expect(
      toSvgPath([
        [-27.47, 153.02],
        [-27.46, 153.03],
      ]),
    ).toContain("L");
  });

  it("formats null duration and heart rate as N/A", () => {
    expect(formatDuration(null)).toBe("N/A");
    expect(formatDistance(null)).toBe("N/A");
    expect(formatHeartRate(null)).toBe("N/A");
  });

  it("formats elapsed seconds as h:mm:ss", () => {
    expect(formatDuration(3723)).toBe("1:02:03");
  });

  it("uses the shared pace formatter", () => {
    expect(formatPace(299.6)).toBe("5:00/km");
    expect(formatPace(299.6, { showUnit: false })).toBe("5:00");
  });

  it("formats meters as kilometres with two decimal places", () => {
    expect(formatDistance(5000)).toBe("5.00 km");
    expect(formatDistance(12345)).toBe("12.35 km");
  });
});
