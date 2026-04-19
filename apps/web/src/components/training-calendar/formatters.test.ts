import { describe, expect, it } from "bun:test";

import { formatCalendarDuration } from "./formatters";

describe("training calendar formatters", () => {
  it("formats durations using two units", () => {
    expect(formatCalendarDuration(3960)).toBe("1h 6m");
    expect(formatCalendarDuration(1710)).toBe("28m 30s");
    expect(formatCalendarDuration(45)).toBe("45s");
    expect(formatCalendarDuration(59.6)).toBe("1m 0s");
  });
});
