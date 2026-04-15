import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import {
  DAYS_OF_WEEK,
  SUPPORTED_RACE_DISTANCES,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
} from "./contracts";
import { DraftConflict } from "./errors";
import { createWeeklyPlanningRouter } from "./router";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("weekly planning router", () => {
  it("rejects reads without a session", () => {
    const router = createWeeklyPlanningRouter({
      service: {
        getState: () => Effect.die("not used"),
        generateDraft: () => Effect.die("not used"),
        generateNextWeek: () => Effect.die("not used"),
        updateDraftSession: () => Effect.die("not used"),
        moveDraftSession: () => Effect.die("not used"),
        regenerateDraft: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(caller.getState()).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through to planner state reads", async () => {
    let requestedUserId: string | undefined;
    const router = createWeeklyPlanningRouter({
      service: {
        getState: (userId) => {
          requestedUserId = userId;
          return Effect.succeed({
            planGoalOptions: [],
            availability: null,
            historySnapshot: {
              generatedAt: "2026-04-01T00:00:00.000Z",
              detailedRuns: [],
              weeklyRollups: [],
            },
            historyQuality: {
              hasAnyHistory: false,
              meetsSnapshotThreshold: false,
              hasRecentSync: false,
              latestSyncWarnings: [],
              availableDateRange: { start: null, end: null },
            },
            performanceSnapshot: {
              allTimePrs: [],
              recentPrs: [],
              processingWarnings: [],
            },
            defaults: null,
            activeDraft: null,
          });
        },
        generateDraft: () => Effect.die("not used"),
        generateNextWeek: () => Effect.die("not used"),
        updateDraftSession: () => Effect.die("not used"),
        moveDraftSession: () => Effect.die("not used"),
        regenerateDraft: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(
      createCallerContext({
        session: {
          id: "session-1",
          userId: "user-1",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        },
        user: {
          id: "user-1",
          email: "runner@example.com",
          name: "Runner One",
        },
      } as NonNullable<Context["session"]>),
    );

    await caller.getState();

    expect(requestedUserId).toBe("user-1");
  });

  it("maps draft conflicts to trpc conflict errors", async () => {
    const router = createWeeklyPlanningRouter({
      service: {
        getState: () => Effect.die("not used"),
        generateDraft: () =>
          Effect.fail(
            new DraftConflict({
              message: "An active weekly draft already exists for this user",
            }),
          ),
        generateNextWeek: () => Effect.die("not used"),
        updateDraftSession: () => Effect.die("not used"),
        moveDraftSession: () => Effect.die("not used"),
        regenerateDraft: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(
      createCallerContext({
        session: {
          id: "session-1",
          userId: "user-1",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        },
        user: {
          id: "user-1",
          email: "runner@example.com",
          name: "Runner One",
        },
      } as NonNullable<Context["session"]>),
    );

    await expect(
      caller.generateDraft({
        planGoal: TRAINING_PLAN_GOALS.race,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        raceBenchmark: {
          estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
          estimatedRaceTimeSeconds: 3000,
        },
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("passes the authenticated user id through to next-week generation", async () => {
    let requestedUserId: string | undefined;
    const router = createWeeklyPlanningRouter({
      service: {
        getState: () => Effect.die("not used"),
        generateDraft: () => Effect.die("not used"),
        generateNextWeek: (userId) => {
          requestedUserId = userId;
          return Effect.die("stop after capture");
        },
        updateDraftSession: () => Effect.die("not used"),
        moveDraftSession: () => Effect.die("not used"),
        regenerateDraft: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(
      createCallerContext({
        session: {
          id: "session-1",
          userId: "user-1",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        },
        user: {
          id: "user-1",
          email: "runner@example.com",
          name: "Runner One",
        },
      } as NonNullable<Context["session"]>),
    );

    await expect(caller.generateNextWeek()).rejects.toBeInstanceOf(TRPCError);
    expect(requestedUserId).toBe("user-1");
  });
});
