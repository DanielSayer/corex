import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createDashboardRouter } from "./router";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("dashboard router", () => {
  it("rejects reads without a session", () => {
    const router = createDashboardRouter({
      service: {
        getForUser: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(caller.get()).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through", async () => {
    let requestedUserId: string | undefined;
    const router = createDashboardRouter({
      service: {
        getForUser: (userId) => {
          requestedUserId = userId;

          return Effect.succeed({
            timezone: "Australia/Brisbane",
            sync: null,
            today: {
              localDate: "2026-04-18",
              state: "rest",
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

    await caller.get();

    expect(requestedUserId).toBe("user-1");
  });
});
