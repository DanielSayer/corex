import { describe, expect, it } from "bun:test";

import { formatDuration, formatHeartRate, toSvgPath } from "./utils";

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
    expect(formatHeartRate(null)).toBe("N/A");
  });

  it("formats elapsed seconds as h:mm:ss", () => {
    expect(formatDuration(3723)).toBe("1:02:03");
  });
});
