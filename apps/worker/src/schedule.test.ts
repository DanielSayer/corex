import { describe, expect, it } from "bun:test";

import { createRecurringJob } from "./recurring-job";
import {
  getHourlyUtcWindowKey,
  getWeeklyPlanRenewalWindowKey,
  getWeeklySnapshotsWindowKey,
} from "./schedule";

describe("worker schedule windows", () => {
  it("returns null before the configured minute offset and a key after it", () => {
    expect(
      getHourlyUtcWindowKey(new Date("2026-04-21T10:04:59.000Z"), 5),
    ).toBeNull();
    expect(getHourlyUtcWindowKey(new Date("2026-04-21T10:05:00.000Z"), 5)).toBe(
      "2026-04-21T10",
    );
  });

  it("uses job-specific offsets for snapshot and renewal runs", () => {
    const sample = new Date("2026-04-21T10:20:00.000Z");

    expect(getWeeklySnapshotsWindowKey(sample)).toBe("2026-04-21T10");
    expect(getWeeklyPlanRenewalWindowKey(sample)).toBeNull();
  });
});

describe("createRecurringJob", () => {
  it("runs at most once per hourly window", async () => {
    let runCount = 0;
    const logger = {
      info: () => undefined,
      error: () => undefined,
    };
    const recurringJob = createRecurringJob(
      {
        name: "test-job",
        getWindowKey: (now) => getHourlyUtcWindowKey(now, 5),
        run: async () => {
          runCount += 1;
        },
      },
      logger,
    );

    expect(
      await recurringJob.tick(new Date("2026-04-21T10:04:00.000Z")),
    ).toBeFalse();
    expect(
      await recurringJob.tick(new Date("2026-04-21T10:05:00.000Z")),
    ).toBeTrue();
    expect(
      await recurringJob.tick(new Date("2026-04-21T10:40:00.000Z")),
    ).toBeFalse();
    expect(
      await recurringJob.tick(new Date("2026-04-21T11:05:00.000Z")),
    ).toBeTrue();
    expect(runCount).toBe(2);
  });
});
