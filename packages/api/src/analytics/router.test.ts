import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createAnalyticsRouter } from "./router";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("analytics router", () => {
  it("rejects reads without a session", () => {
    const router = createAnalyticsRouter({
      service: {
        getForUser: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(
      caller.get({
        year: 2026,
        timezone: "Australia/Brisbane",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id and input through", async () => {
    let requested:
      | {
          userId: string;
          year: number;
          timezone: string;
        }
      | undefined;

    const router = createAnalyticsRouter({
      service: {
        getForUser: (userId, input) => {
          requested = { userId, ...input };

          return Effect.succeed({
            availableYears: [2026],
            selectedYear: input.year,
            distanceTrends: {
              month: [],
              week: [],
            },
            prTrends: {
              distances: [],
              series: [],
            },
            overallPrs: [],
            longestRun: null,
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
      year: 2026,
      timezone: "Australia/Brisbane",
    });

    expect(requested).toEqual({
      userId: "user-1",
      year: 2026,
      timezone: "Australia/Brisbane",
    });
  });

  it("validates timezone input before invoking the service", async () => {
    const router = createAnalyticsRouter({
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
        year: 2026,
        timezone: "not-a-timezone",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });
});
