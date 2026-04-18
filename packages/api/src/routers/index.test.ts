import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createDashboardRouter } from "../dashboard/router";
import { createGoalProgressRouter } from "../goal-progress/router";
import { InvalidSettings } from "../training-settings/errors";
import { createTrainingSettingsRouter } from "../training-settings/router";
import { createAppRouter } from "./index";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("appRouter", () => {
  it("returns the public health check without a session", () => {
    const appRouter = createAppRouter({
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          getTimezoneForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
          updateTimezoneForUser: () => Effect.die("not used"),
          updateAutomaticWeeklyPlanRenewalForUser: () => Effect.die("not used"),
        },
      }),
      goalProgress: createGoalProgressRouter({
        service: {
          getForUser: () =>
            Effect.succeed({
              timezone: "UTC",
              sync: {
                hasAnyHistory: false,
                hasRecentSync: false,
                latestSyncWarnings: [],
                availableDateRange: { start: null, end: null },
                recommendedAction: "create_goal" as const,
              },
              activeGoals: [],
              completedGoals: [],
            }),
        },
      }),
    });
    const caller = appRouter.createCaller(createCallerContext(null));

    expect(caller.healthCheck()).resolves.toBe("OK");
  });

  it("rejects dashboard reads without a session", () => {
    const appRouter = createAppRouter({
      dashboard: createDashboardRouter({
        service: {
          getForUser: () => Effect.die("not used"),
        },
      }),
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          getTimezoneForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
          updateTimezoneForUser: () => Effect.die("not used"),
          updateAutomaticWeeklyPlanRenewalForUser: () => Effect.die("not used"),
        },
      }),
      goalProgress: createGoalProgressRouter({
        service: {
          getForUser: () => Effect.die("not used"),
        },
      }),
    });
    const caller = appRouter.createCaller(createCallerContext(null));

    expect(caller.dashboard.get()).rejects.toBeInstanceOf(TRPCError);
  });

  it("returns dashboard data when a session is present", () => {
    const appRouter = createAppRouter({
      dashboard: createDashboardRouter({
        service: {
          getForUser: () =>
            Effect.succeed({
              timezone: "Australia/Brisbane",
              sync: null,
              today: {
                localDate: "2026-04-18",
                state: "rest" as const,
                title: "No workouts scheduled for today",
                subtitle: "Today is a rest day. Enjoy your day off.",
                sessionType: "rest" as const,
                estimatedDistanceMeters: null,
                estimatedDurationSeconds: null,
              },
              weekly: {
                weekToDate: {
                  startDate: "2026-04-13",
                  endDate: "2026-04-18",
                },
                distance: {
                  thisWeekMeters: 0,
                  vsLastWeekMeters: 0,
                  avgWeekMeters: 0,
                  series: [],
                },
                pace: {
                  thisWeekSecPerKm: null,
                  vsLastWeekSecPerKm: null,
                  avgWeekSecPerKm: null,
                  series: [],
                },
              },
              goals: [],
              recentActivities: [],
            }),
        },
      }),
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          getTimezoneForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
          updateTimezoneForUser: () => Effect.die("not used"),
          updateAutomaticWeeklyPlanRenewalForUser: () => Effect.die("not used"),
        },
      }),
      goalProgress: createGoalProgressRouter({
        service: {
          getForUser: () => Effect.die("not used"),
        },
      }),
    });
    const caller = appRouter.createCaller(
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

    expect(caller.dashboard.get()).resolves.toMatchObject({
      timezone: "Australia/Brisbane",
    });
  });

  it("rejects training settings reads without a session", () => {
    const appRouter = createAppRouter({
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          getTimezoneForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
          updateTimezoneForUser: () => Effect.die("not used"),
          updateAutomaticWeeklyPlanRenewalForUser: () => Effect.die("not used"),
        },
      }),
      goalProgress: createGoalProgressRouter({
        service: {
          getForUser: () => Effect.die("not used"),
        },
      }),
    });
    const caller = appRouter.createCaller(createCallerContext(null));

    expect(caller.trainingSettings.get()).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through to training settings reads", async () => {
    let requestedUserId: string | undefined;
    const appRouter = createAppRouter({
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: (userId) => {
            requestedUserId = userId;
            return Effect.succeed({
              status: "not_started" as const,
              availability: null,
              preferences: {
                timezone: "UTC",
                automaticWeeklyPlanRenewalEnabled: false,
              },
              intervalsCredential: {
                hasKey: false,
                username: null,
                updatedAt: null,
              },
            });
          },
          getTimezoneForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
          updateTimezoneForUser: () => Effect.die("not used"),
          updateAutomaticWeeklyPlanRenewalForUser: () => Effect.die("not used"),
        },
      }),
      goalProgress: createGoalProgressRouter({
        service: {
          getForUser: () => Effect.die("not used"),
        },
      }),
    });
    const caller = appRouter.createCaller(
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

    await caller.trainingSettings.get();

    expect(requestedUserId).toBe("user-1");
  });

  it("maps domain validation failures to bad-request errors for training settings writes", async () => {
    const appRouter = createAppRouter({
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          getTimezoneForUser: () => Effect.die("not used"),
          upsertForUser: () =>
            Effect.fail(
              new InvalidSettings({
                message: "Unavailable days cannot define a max duration",
              }),
            ),
          updateTimezoneForUser: () => Effect.die("not used"),
          updateAutomaticWeeklyPlanRenewalForUser: () => Effect.die("not used"),
        },
      }),
      goalProgress: createGoalProgressRouter({
        service: {
          getForUser: () => Effect.die("not used"),
        },
      }),
    });
    const caller = appRouter.createCaller(
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
      caller.trainingSettings.upsert({
        goal: {
          type: "volume_goal",
          metric: "distance",
          period: "week",
          targetValue: 20,
          unit: "km",
        },
        availability: {
          monday: { available: true, maxDurationMinutes: 45 },
          tuesday: { available: false, maxDurationMinutes: null },
          wednesday: { available: true, maxDurationMinutes: 60 },
          thursday: { available: false, maxDurationMinutes: null },
          friday: { available: true, maxDurationMinutes: null },
          saturday: { available: true, maxDurationMinutes: 90 },
          sunday: { available: false, maxDurationMinutes: null },
        },
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "intervals-key",
        timezone: "Australia/Brisbane",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Unavailable days cannot define a max duration",
    });
  });
});
