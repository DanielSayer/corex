import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createGoalsRouter } from "./router";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("goals router", () => {
  it("rejects goal reads without a session", () => {
    const router = createGoalsRouter({
      service: {
        getForUser: () => Effect.die("not used"),
        createForUser: () => Effect.die("not used"),
        updateForUser: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(caller.get()).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through to goal reads", async () => {
    let requestedUserId: string | undefined;
    const router = createGoalsRouter({
      service: {
        getForUser: (userId) => {
          requestedUserId = userId;
          return Effect.succeed([]);
        },
        createForUser: () => Effect.die("not used"),
        updateForUser: () => Effect.die("not used"),
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

    await caller.get();

    expect(requestedUserId).toBe("user-1");
  });

  it("passes the authenticated user id through to goal creation", async () => {
    let requestedUserId: string | undefined;
    const router = createGoalsRouter({
      service: {
        getForUser: () => Effect.die("not used"),
        createForUser: (userId, goal) => {
          requestedUserId = userId;

          return Effect.succeed({
            id: "goal-1",
            status: "active" as const,
            goal,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-21T00:00:00.000Z",
          });
        },
        updateForUser: () => Effect.die("not used"),
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

    await caller.create({
      type: "volume_goal",
      metric: "distance",
      period: "week",
      targetValue: 50,
      unit: "km",
    });

    expect(requestedUserId).toBe("user-1");
  });

  it("passes the authenticated user id and goal id through to goal updates", async () => {
    let requestedUserId: string | undefined;
    let requestedGoalId: string | undefined;
    const router = createGoalsRouter({
      service: {
        getForUser: () => Effect.die("not used"),
        createForUser: () => Effect.die("not used"),
        updateForUser: (userId, goalId, goal) => {
          requestedUserId = userId;
          requestedGoalId = goalId;

          return Effect.succeed({
            id: goalId,
            status: "active" as const,
            goal,
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-21T00:00:00.000Z",
          });
        },
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

    await caller.update({
      id: "goal-1",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 50,
        unit: "km",
      },
    });

    expect(requestedUserId).toBe("user-1");
    expect(requestedGoalId).toBe("goal-1");
  });
});
