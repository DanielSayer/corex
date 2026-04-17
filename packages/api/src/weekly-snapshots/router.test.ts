import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createWeeklySnapshotsRouter } from "./router";
import type { StoredWeeklySnapshot } from "./repository";

const storedSnapshot: StoredWeeklySnapshot = {
  id: "snapshot-1",
  userId: "user-1",
  timezone: "Australia/Brisbane",
  weekStart: new Date("2026-04-05T14:00:00.000Z"),
  weekEnd: new Date("2026-04-12T14:00:00.000Z"),
  generatedAt: new Date("2026-04-13T01:00:00.000Z"),
  sourceSyncCompletedAt: null,
  payload: {
    shouldShow: true,
    generatedAt: "2026-04-13T01:00:00.000Z",
    period: {
      weekStart: "2026-04-05T14:00:00.000Z",
      weekEnd: "2026-04-12T14:00:00.000Z",
      timezone: "Australia/Brisbane",
    },
    totals: null,
    comparisonVsPriorWeek: null,
    goals: [],
    highlights: null,
  },
  createdAt: new Date("2026-04-13T01:00:00.000Z"),
  updatedAt: new Date("2026-04-13T01:00:00.000Z"),
};

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
        listForUser: () => Effect.die("not used"),
        ensureLatestForUser: () => Effect.die("not used"),
        getByWeekForUser: () => Effect.die("not used"),
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
        createWeeklySnapshotForUserIfMissing: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(caller.getLatest()).rejects.toBeInstanceOf(TRPCError);
  });

  it("rejects snapshot list reads without a session", () => {
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: () => Effect.die("not used"),
        listForUser: () => Effect.die("not used"),
        ensureLatestForUser: () => Effect.die("not used"),
        getByWeekForUser: () => Effect.die("not used"),
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
        createWeeklySnapshotForUserIfMissing: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(caller.list()).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through to latest snapshot reads", async () => {
    let requestedUserId: string | undefined;
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: (userId) => {
          requestedUserId = userId;
          return Effect.succeed(null);
        },
        listForUser: () => Effect.die("not used"),
        ensureLatestForUser: () => Effect.die("not used"),
        getByWeekForUser: () => Effect.die("not used"),
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
        createWeeklySnapshotForUserIfMissing: () => Effect.die("not used"),
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

  it("passes the authenticated user id through to snapshot list reads", async () => {
    let requestedUserId: string | undefined;
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: () => Effect.die("not used"),
        listForUser: (userId) => {
          requestedUserId = userId;
          return Effect.succeed([]);
        },
        ensureLatestForUser: () => Effect.die("not used"),
        getByWeekForUser: () => Effect.die("not used"),
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
        createWeeklySnapshotForUserIfMissing: () => Effect.die("not used"),
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

    await caller.list();

    expect(requestedUserId).toBe("user-1");
  });

  it("passes the authenticated user id through to latest snapshot generation", async () => {
    let requested:
      | {
          userId: string;
        }
      | undefined;
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: () => Effect.die("not used"),
        listForUser: () => Effect.die("not used"),
        ensureLatestForUser: (userId) => {
          requested = { userId };
          return Effect.succeed(storedSnapshot);
        },
        getByWeekForUser: () => Effect.die("not used"),
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
        createWeeklySnapshotForUserIfMissing: () => Effect.die("not used"),
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

    await caller.ensureLatest();

    expect(requested).toEqual({
      userId: "user-1",
    });
  });

  it("passes the authenticated user id and week through to by-week reads", async () => {
    let requested:
      | {
          userId: string;
          weekStart: Date;
          weekEnd: Date;
          timezone: string;
        }
      | undefined;
    const router = createWeeklySnapshotsRouter({
      service: {
        getLatestForUser: () => Effect.die("not used"),
        listForUser: () => Effect.die("not used"),
        ensureLatestForUser: () => Effect.die("not used"),
        getByWeekForUser: (input) => {
          requested = input;
          return Effect.succeed(null);
        },
        generateWeeklySnapshotForUser: () => Effect.die("not used"),
        createWeeklySnapshotForUserIfMissing: () => Effect.die("not used"),
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
      weekStart: "2026-04-05T14:00:00.000Z",
      weekEnd: "2026-04-12T14:00:00.000Z",
      timezone: "Australia/Brisbane",
    });

    expect(requested).toEqual({
      userId: "user-1",
      weekStart: new Date("2026-04-05T14:00:00.000Z"),
      weekEnd: new Date("2026-04-12T14:00:00.000Z"),
      timezone: "Australia/Brisbane",
    });
  });
});
