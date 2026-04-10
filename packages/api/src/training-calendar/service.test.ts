import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createTrainingCalendarService } from "./service";

function createDraft() {
  return {
    id: "plan-1",
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
            title: "Workout",
            summary: "Quality",
            coachingNotes: null,
            estimatedDurationSeconds: 2400,
            estimatedDistanceMeters: 7000,
            intervalBlocks: [],
          },
        },
        { date: "2026-04-08", session: null },
      ],
    },
  } as const;
}

describe("training calendar service", () => {
  it("creates a valid same-date link", async () => {
    let createdLink:
      | {
          userId: string;
          weeklyPlanId: string;
          plannedDate: string;
          activityId: string;
        }
      | undefined;

    const service = createTrainingCalendarService({
      weeklyPlanningRepo: {
        getActiveDraft: () => Effect.succeed(createDraft() as never),
      },
      repo: {
        listActivitiesInRange: () => Effect.succeed([]),
        listLinksForDraft: () => Effect.succeed([]),
        getActivity: () =>
          Effect.succeed({
            id: "run-1",
            name: "Morning run",
            startDate: new Date("2026-04-06T06:00:00.000Z"),
            elapsedTime: 1800,
            distance: 5000,
            averageHeartrate: 148,
            trainingLoad: 40,
            totalElevationGain: 20,
          }),
        getLinkForPlannedDate: () => Effect.succeed(null),
        getLinkForActivity: () => Effect.succeed(null),
        createLink: (input: {
          userId: string;
          weeklyPlanId: string;
          plannedDate: string;
          activityId: string;
        }) => {
          createdLink = input;
          return Effect.succeed({
            weeklyPlanId: input.weeklyPlanId,
            plannedDate: input.plannedDate,
            activityId: input.activityId,
          });
        },
      } as never,
    });

    const result = await Effect.runPromise(
      service.linkActivity("user-1", {
        plannedDate: "2026-04-06",
        activityId: "run-1",
        timezone: "Australia/Brisbane",
      }),
    );

    expect(result).toEqual({
      plannedDate: "2026-04-06",
      activityId: "run-1",
    });
    expect(createdLink).toEqual({
      userId: "user-1",
      weeklyPlanId: "plan-1",
      plannedDate: "2026-04-06",
      activityId: "run-1",
    });
  });

  it("rejects cross-date activity links", async () => {
    const service = createTrainingCalendarService({
      weeklyPlanningRepo: {
        getActiveDraft: () => Effect.succeed(createDraft() as never),
      },
      repo: {
        listActivitiesInRange: () => Effect.succeed([]),
        listLinksForDraft: () => Effect.succeed([]),
        getActivity: () =>
          Effect.succeed({
            id: "run-2",
            name: "Wrong date run",
            startDate: new Date("2026-04-08T06:00:00.000Z"),
            elapsedTime: 1500,
            distance: 4000,
            averageHeartrate: 144,
            trainingLoad: 28,
            totalElevationGain: 12,
          }),
        getLinkForPlannedDate: () => Effect.succeed(null),
        getLinkForActivity: () =>
          Effect.succeed({
            weeklyPlanId: "plan-0",
            plannedDate: "2026-04-05",
            activityId: "run-2",
          }),
        createLink: () => Effect.die("not used"),
      } as never,
    });

    await expect(
      Effect.runPromise(
        service.linkActivity("user-1", {
          plannedDate: "2026-04-06",
          activityId: "run-2",
          timezone: "Australia/Brisbane",
        }),
      ),
    ).rejects.toMatchObject({
      message:
        "Selected activity must occur on the same local calendar date as the planned session",
    });
  });
});
