import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createActivityHistoryRouter } from "./router";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("activity history router", () => {
  it("rejects reads without a session", () => {
    const router = createActivityHistoryRouter({
      service: {
        activitySummary: () => Effect.die("not used"),
        activityAnalysis: () => Effect.die("not used"),
        calendar: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(
      caller.activitySummary({
        activityId: "run-1",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through to activity summary reads", async () => {
    let requestedUserId: string | undefined;
    const router = createActivityHistoryRouter({
      service: {
        activitySummary: (userId) => {
          requestedUserId = userId;
          return Effect.succeed(null);
        },
        activityAnalysis: () => Effect.die("not used"),
        calendar: () => Effect.die("not used"),
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

    await caller.activitySummary({
      activityId: "run-1",
    });

    expect(requestedUserId).toBe("user-1");
  });

  it("validates calendar input before invoking the service", async () => {
    let called = false;
    const router = createActivityHistoryRouter({
      service: {
        activitySummary: () => Effect.die("not used"),
        activityAnalysis: () => Effect.die("not used"),
        calendar: () => {
          called = true;
          return Effect.succeed({
            activities: [],
            weeks: [],
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

    await expect(
      caller.calendar({
        from: "2026-04-13T00:00:00.000Z",
        to: "2026-03-30T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(called).toBe(false);
  });
});
