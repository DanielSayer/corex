import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createWeeklySnapshotsRouter } from "./router";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("weekly snapshots router", () => {
  it("rejects snapshot reads without a session", () => {
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: () => Effect.die("not used"),
        getByWeekForUser: () => Effect.die("not used"),
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(caller.getLatest()).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through to latest snapshot reads", async () => {
    let requestedUserId: string | undefined;
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: (userId) => {
          requestedUserId = userId;
          return Effect.succeed(null);
        },
        getByWeekForUser: () => Effect.die("not used"),
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
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

    await caller.getLatest();

    expect(requestedUserId).toBe("user-1");
  });

  it("passes the authenticated user id and week through to by-week reads", async () => {
    let requested:
      | {
          userId: string;
          timezone: string;
          weekStart: Date;
          weekEnd: Date;
        }
      | undefined;
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: () => Effect.die("not used"),
        getByWeekForUser: (input) => {
          requested = input;
          return Effect.succeed(null);
        },
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
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

    await caller.getByWeek({
      timezone: "Australia/Brisbane",
      weekStart: "2026-04-05T14:00:00.000Z",
      weekEnd: "2026-04-12T14:00:00.000Z",
    });

    expect(requested).toEqual({
      userId: "user-1",
      timezone: "Australia/Brisbane",
      weekStart: new Date("2026-04-05T14:00:00.000Z"),
      weekEnd: new Date("2026-04-12T14:00:00.000Z"),
    });
  });

  it("validates timezone input for by-week reads", async () => {
    let called = false;
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: () => Effect.die("not used"),
        getByWeekForUser: () => {
          called = true;
          return Effect.succeed(null);
        },
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
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
      caller.getByWeek({
        timezone: "Not/AZone",
        weekStart: "2026-04-05T14:00:00.000Z",
        weekEnd: "2026-04-12T14:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(called).toBe(false);
  });
});
