import { describe, expect, it } from "bun:test";

import type { WeeklyPlanPayload } from "../weekly-planning/contracts";
import { buildPlanAdherenceSummary } from "./domain";

function createPayload(): WeeklyPlanPayload {
  return {
    days: [
      {
        date: "2026-04-06",
        session: {
          sessionType: "easy_run",
          title: "Easy run",
          summary: "Aerobic",
          coachingNotes: null,
          estimatedDurationSeconds: 1800,
          estimatedDistanceMeters: 5000,
          intervalBlocks: [],
        },
      },
      {
        date: "2026-04-07",
        session: {
          sessionType: "workout",
          title: "Tempo",
          summary: "Threshold",
          coachingNotes: null,
          estimatedDurationSeconds: 2400,
          estimatedDistanceMeters: 7000,
          intervalBlocks: [],
        },
      },
      {
        date: "2026-04-08",
        session: {
          sessionType: "easy_run",
          title: "Short easy",
          summary: "Recovery",
          coachingNotes: null,
          estimatedDurationSeconds: 2000,
          estimatedDistanceMeters: 6000,
          intervalBlocks: [],
        },
      },
      {
        date: "2026-04-09",
        session: {
          sessionType: "easy_run",
          title: "Missed easy",
          summary: "Aerobic",
          coachingNotes: null,
          estimatedDurationSeconds: 1800,
          estimatedDistanceMeters: 5000,
          intervalBlocks: [],
        },
      },
      {
        date: "2026-04-10",
        session: {
          sessionType: "rest",
          title: "Rest",
          summary: "Recover",
          coachingNotes: null,
          estimatedDurationSeconds: 0,
          estimatedDistanceMeters: null,
          intervalBlocks: [],
        },
      },
      {
        date: "2026-04-11",
        session: {
          sessionType: "long_run",
          title: "Long run",
          summary: "Steady",
          coachingNotes: null,
          estimatedDurationSeconds: 3600,
          estimatedDistanceMeters: 10000,
          intervalBlocks: [],
        },
      },
      { date: "2026-04-12", session: null },
    ],
  };
}

describe("plan adherence domain", () => {
  it("classifies linked, moved, partial, missed, future, and extra sessions", () => {
    const summary = buildPlanAdherenceSummary({
      plan: {
        id: "plan-1",
        startDate: "2026-04-06",
        endDate: "2026-04-12",
        payload: createPayload(),
      },
      timezone: "Australia/Brisbane",
      currentLocalDate: "2026-04-10",
      activities: [
        {
          id: "run-completed",
          name: "Easy completion",
          startDate: new Date("2026-04-06T06:00:00.000Z"),
          elapsedTime: 1800,
          distance: 5000,
        },
        {
          id: "run-moved",
          name: "Moved tempo",
          startDate: new Date("2026-04-08T06:00:00.000Z"),
          elapsedTime: 2400,
          distance: 7000,
        },
        {
          id: "run-partial",
          name: "Short completion",
          startDate: new Date("2026-04-08T07:00:00.000Z"),
          elapsedTime: 600,
          distance: 1500,
        },
        {
          id: "run-extra",
          name: "Rest day jog",
          startDate: new Date("2026-04-10T06:00:00.000Z"),
          elapsedTime: 1200,
          distance: 3000,
        },
      ],
      links: [
        {
          weeklyPlanId: "plan-1",
          plannedDate: "2026-04-06",
          activityId: "run-completed",
        },
        {
          weeklyPlanId: "plan-1",
          plannedDate: "2026-04-07",
          activityId: "run-moved",
        },
        {
          weeklyPlanId: "plan-1",
          plannedDate: "2026-04-08",
          activityId: "run-partial",
        },
      ],
    });

    expect(summary.sessions.map((session) => session.status)).toEqual([
      "completed",
      "moved",
      "partial",
      "missed",
      "planned",
    ]);
    expect(summary.sessions[1]).toMatchObject({
      plannedDate: "2026-04-07",
      actualLocalDate: "2026-04-08",
    });
    expect(summary.extras).toEqual([
      expect.objectContaining({
        activityId: "run-extra",
        localDate: "2026-04-10",
      }),
    ]);
    expect(summary.totals).toMatchObject({
      plannedSessionCount: 5,
      completedCount: 1,
      movedCount: 1,
      partialCount: 1,
      missedCount: 1,
      plannedCount: 1,
      extraCount: 1,
      adheredSessionRatio: 0.4,
    });
    expect(summary.totals.targetCompletionRatio).toBeCloseTo(0.46, 2);
  });
});
