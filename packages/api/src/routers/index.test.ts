import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createIntervalsSyncRouter } from "../intervals-sync/router";
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
          upsertForUser: () => Effect.die("not used"),
        },
      }),
    });
    const caller = appRouter.createCaller(createCallerContext(null));

    expect(caller.healthCheck()).resolves.toBe("OK");
  });

  it("rejects protected data without a session", () => {
    const appRouter = createAppRouter({
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
        },
      }),
    });
    const caller = appRouter.createCaller(createCallerContext(null));

    expect(caller.privateData()).rejects.toBeInstanceOf(TRPCError);
  });

  it("returns protected data when a session is present", () => {
    const appRouter = createAppRouter({
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
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

    expect(caller.privateData()).resolves.toMatchObject({
      message: "This is private",
      user: {
        id: "user-1",
        email: "runner@example.com",
      },
    });
  });

  it("rejects training settings reads without a session", () => {
    const appRouter = createAppRouter({
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
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
              goal: null,
              availability: null,
              intervalsCredential: {
                hasKey: false,
                username: null,
                updatedAt: null,
              },
            });
          },
          upsertForUser: () => Effect.die("not used"),
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
          upsertForUser: () =>
            Effect.fail(
              new InvalidSettings({
                message: "Unavailable days cannot define a max duration",
              }),
            ),
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
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Unavailable days cannot define a max duration",
    });
  });

  it("passes the authenticated user id through to recent activities reads", async () => {
    let requestedUserId: string | undefined;
    const appRouter = createAppRouter({
      trainingSettings: createTrainingSettingsRouter({
        service: {
          getForUser: () => Effect.die("not used"),
          upsertForUser: () => Effect.die("not used"),
        },
      }),
      intervalsSync: createIntervalsSyncRouter({
        service: {
          syncNow: () => Effect.die("not used"),
          latest: () => Effect.die("not used"),
          recentActivities: (userId) => {
            requestedUserId = userId;
            return Effect.succeed([]);
          },
          activitySummary: () => Effect.die("not used"),
          activityAnalysis: () => Effect.die("not used"),
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

    await caller.intervalsSync.recentActivities();

    expect(requestedUserId).toBe("user-1");
  });
});
