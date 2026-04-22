import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { aggregateTerrainSummary } from "../terrain/domain";
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
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id and input through", async () => {
    let requested:
      | {
          userId: string;
          year: number;
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
            overview: {
              totalDistance: {
                distanceMeters: 0,
                comparisonYear: input.year - 1,
                comparisonDistanceMeters: 0,
                deltaPercent: null,
                cutoffDateKey: `${input.year}-12-31`,
                isPartialYear: false,
              },
              longestRunInYear: null,
              trackedPrDistanceCount: 0,
              allTimePrCount: 0,
              activeMonths: {
                count: 0,
                elapsedCount: 12,
                rangeLabel: null,
              },
            },
            consistency: {
              activeMonthCount: 0,
              elapsedMonthCount: 12,
              ratio: 0,
              percent: 0,
              months: [],
            },
            trainingMix: {
              totalDistanceMeters: 0,
              buckets: [],
            },
            terrainSummary: aggregateTerrainSummary([]),
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
    });

    expect(requested).toEqual({
      userId: "user-1",
      year: 2026,
    });
  });
});
