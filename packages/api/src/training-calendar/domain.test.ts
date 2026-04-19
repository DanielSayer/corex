import { describe, expect, it } from "bun:test";

import { buildTrainingCalendarMonth } from "./domain";

describe("training calendar domain", () => {
  it("overlays active draft sessions, preserves actual-only week totals, and suppresses linked activity duplicates", () => {
    const result = buildTrainingCalendarMonth(
      {
        from: "2026-04-06T00:00:00.000Z",
        to: "2026-04-13T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      },
      {
        plans: [
          {
            id: "plan-1",
            startDate: "2026-04-06",
            endDate: "2026-04-12",
            payload: {
              days: [
                {
                  date: "2026-04-06",
                  session: {
                    sessionType: "easy_run",
                    title: "Easy run",
                    summary: "Aerobic work",
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
                    title: "Tempo session",
                    summary: "Threshold reps",
                    coachingNotes: null,
                    estimatedDurationSeconds: 2400,
                    estimatedDistanceMeters: 7000,
                    intervalBlocks: [],
                  },
                },
                { date: "2026-04-08", session: null },
                { date: "2026-04-09", session: null },
                { date: "2026-04-10", session: null },
                { date: "2026-04-11", session: null },
                { date: "2026-04-12", session: null },
              ],
            },
          },
        ],
        activityRecords: [
          {
            id: "run-1",
            name: "Easy completion",
            startDate: new Date("2026-04-06T06:00:00.000Z"),
            elapsedTime: 1800,
            distance: 5000,
            averageHeartrate: 148,
            trainingLoad: 40,
            totalElevationGain: 20,
          },
          {
            id: "run-2",
            name: "Unlinked workout",
            startDate: new Date("2026-04-07T06:00:00.000Z"),
            elapsedTime: 2400,
            distance: 7000,
            averageHeartrate: 155,
            trainingLoad: 60,
            totalElevationGain: 35,
          },
        ],
        links: [
          {
            weeklyPlanId: "plan-1",
            plannedDate: "2026-04-06",
            activityId: "run-1",
          },
        ],
        currentLocalDate: "2026-04-07",
      },
    );

    expect(result.weeks).toEqual([
      {
        weekStart: "2026-04-06",
        weekEnd: "2026-04-12",
        time: 4200,
        distance: 12000,
        totalElevationGain: 55,
        averagePaceSecondsPerKm: 350,
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
    expect(result.activities.map((activity) => activity.id)).toEqual(["run-2"]);
    expect(result.plannedSessions).toEqual([
      {
        date: "2026-04-06",
        status: "completed",
        sessionType: "easy_run",
        title: "Easy run",
        summary: "Aerobic work",
        estimatedDurationSeconds: 1800,
        estimatedDistanceMeters: 5000,
        actualLocalDate: "2026-04-06",
        targetCompletionRatio: 1,
        linkedActivity: expect.objectContaining({
          id: "run-1",
          name: "Easy completion",
        }),
        candidateActivities: [],
      },
      {
        date: "2026-04-07",
        status: "planned",
        sessionType: "workout",
        title: "Tempo session",
        summary: "Threshold reps",
        estimatedDurationSeconds: 2400,
        estimatedDistanceMeters: 7000,
        actualLocalDate: null,
        targetCompletionRatio: 0,
        linkedActivity: null,
        candidateActivities: [
          expect.objectContaining({
            id: "run-2",
            name: "Unlinked workout",
          }),
        ],
      },
    ]);
  });

  it("counts linked moved activities in the planned session week", () => {
    const result = buildTrainingCalendarMonth(
      {
        from: "2026-03-30T00:00:00.000Z",
        to: "2026-04-13T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      },
      {
        plans: [
          {
            id: "plan-1",
            startDate: "2026-04-06",
            endDate: "2026-04-12",
            payload: {
              days: [
                {
                  date: "2026-04-06",
                  session: {
                    sessionType: "easy_run",
                    title: "Easy run",
                    summary: "Aerobic work",
                    coachingNotes: null,
                    estimatedDurationSeconds: 3000,
                    estimatedDistanceMeters: 10000,
                    intervalBlocks: [],
                  },
                },
                { date: "2026-04-07", session: null },
                { date: "2026-04-08", session: null },
                { date: "2026-04-09", session: null },
                { date: "2026-04-10", session: null },
                { date: "2026-04-11", session: null },
                { date: "2026-04-12", session: null },
              ],
            },
          },
        ],
        activityRecords: [
          {
            id: "w14-run",
            name: "Saturday run",
            startDate: new Date("2026-04-04T21:00:00.000Z"),
            elapsedTime: 1500,
            distance: 5000,
            averageHeartrate: 148,
            trainingLoad: 40,
            totalElevationGain: 20,
          },
          {
            id: "linked-sunday-run",
            name: "Linked Sunday run",
            startDate: new Date("2026-04-05T05:00:00.000Z"),
            elapsedTime: 3000,
            distance: 10000,
            averageHeartrate: 150,
            trainingLoad: 70,
            totalElevationGain: 50,
          },
          {
            id: "w15-run",
            name: "Friday run",
            startDate: new Date("2026-04-10T21:00:00.000Z"),
            elapsedTime: 1500,
            distance: 5000,
            averageHeartrate: 145,
            trainingLoad: 35,
            totalElevationGain: 15,
          },
        ],
        links: [
          {
            weeklyPlanId: "plan-1",
            plannedDate: "2026-04-06",
            activityId: "linked-sunday-run",
          },
        ],
        currentLocalDate: "2026-04-11",
      },
    );

    expect(result.weeks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weekStart: "2026-03-30",
          distance: 5000,
        }),
        expect.objectContaining({
          weekStart: "2026-04-06",
          distance: 15000,
        }),
      ]),
    );
    expect(result.activities.map((activity) => activity.id)).toEqual([
      "w14-run",
      "w15-run",
    ]);
    expect(result.plannedSessions[0]).toMatchObject({
      date: "2026-04-06",
      status: "moved",
      actualLocalDate: "2026-04-05",
      linkedActivity: expect.objectContaining({
        id: "linked-sunday-run",
      }),
    });
  });
});
