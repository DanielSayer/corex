import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createGoalProgressRouter } from "./router";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("goal progress router", () => {
  it("rejects reads without a session", () => {
    const router = createGoalProgressRouter({
      service: {
        getForUser: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(caller.get()).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through to goal progress reads", async () => {
    let requestedUserId: string | undefined;
    let requestedTimezone: string | undefined;
    const router = createGoalProgressRouter({
      service: {
        getForUser: (userId, timezone) => {
          requestedUserId = userId;
          requestedTimezone = timezone;
          return Effect.succeed({
            timezone: timezone ?? "UTC",
            sync: {
              hasAnyHistory: false,
              hasRecentSync: false,
              latestSyncWarnings: [],
              availableDateRange: {
                start: null,
                end: null,
              },
              recommendedAction: "create_goal" as const,
            },
            activeGoals: [],
            completedGoals: [],
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

    await caller.get({
      timezone: "Australia/Brisbane",
    });

    expect(requestedUserId).toBe("user-1");
    expect(requestedTimezone).toBe("Australia/Brisbane");
  });

  it("validates timezone input before invoking the service", async () => {
    const router = createGoalProgressRouter({
      service: {
        getForUser: () => Effect.die("not used"),
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
      caller.get({
        timezone: "not-a-timezone",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
