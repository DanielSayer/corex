import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import type { Context } from "../context";
import { createIntervalsSyncRouter } from "./router";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

function buildFullSyncSummary() {
  return {
    eventId: "sync-1",
    status: "success" as const,
    historyCoverage: "initial_30d_window" as const,
    cursorStartUsed: "2026-02-20T00:00:00.000Z",
    coveredDateRange: {
      start: "2026-03-20T00:00:00.000Z",
      end: "2026-03-20T00:00:00.000Z",
    },
    newestImportedActivityStart: "2026-03-20T00:00:00.000Z",
    insertedCount: 1,
    updatedCount: 2,
    skippedNonRunningCount: 1,
    skippedInvalidCount: 0,
    failedDetailCount: 0,
    failedMapCount: 0,
    failedStreamCount: 0,
    storedMapCount: 1,
    storedStreamCount: 5,
    unknownActivityTypes: [],
    warnings: ["unsupported activity skipped"],
    failedDetails: [],
    failureCategory: null,
    failureMessage: null,
    startedAt: "2026-03-21T00:00:00.000Z",
    completedAt: "2026-03-21T00:05:00.000Z",
  };
}

describe("intervals sync router", () => {
  it("rejects sync history reads without a session", () => {
    const router = createIntervalsSyncRouter({
      service: {
        latest: () => Effect.die("not used"),
        listEvents: () => Effect.die("not used"),
        syncNow: () => Effect.die("not used"),
      },
    });
    const caller = router.createCaller(createCallerContext(null));

    expect(caller.listEvents()).rejects.toBeInstanceOf(TRPCError);
  });

  it("passes the authenticated user id through to sync history reads", async () => {
    let requestedUserId: string | undefined;
    let requestedLimit: number | undefined;
    const router = createIntervalsSyncRouter({
      service: {
        latest: () => Effect.die("not used"),
        listEvents: (userId, input) => {
          requestedUserId = userId;
          requestedLimit = input?.limit;
          return Effect.succeed({ items: [], nextOffset: null });
        },
        syncNow: () => Effect.die("not used"),
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

    await caller.listEvents({ limit: 5, offset: 0 });

    expect(requestedUserId).toBe("user-1");
    expect(requestedLimit).toBe(5);
  });

  it("maps latest sync responses to the compact status summary", async () => {
    const router = createIntervalsSyncRouter({
      service: {
        latest: () => Effect.succeed(buildFullSyncSummary()),
        listEvents: () => Effect.die("not used"),
        syncNow: () => Effect.die("not used"),
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

    const result = await caller.latest();

    expect(result).not.toBeNull();
    if (!result) {
      throw new Error("Expected sync summary");
    }

    expect(result).toMatchObject({
      status: "success",
      runsProcessed: 3,
      newRuns: 1,
      updatedRuns: 2,
      unsupportedCount: 1,
      warningCount: 1,
      lastCompletedAt: "2026-03-21T00:05:00.000Z",
    });
    expect("eventId" in result).toBe(false);
  });

  it("maps trigger responses to the compact status summary", async () => {
    const router = createIntervalsSyncRouter({
      service: {
        latest: () => Effect.die("not used"),
        listEvents: () => Effect.die("not used"),
        syncNow: () => Effect.succeed(buildFullSyncSummary()),
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

    const result = await caller.trigger();

    expect(result).toMatchObject({
      status: "success",
      runsProcessed: 3,
      newRuns: 1,
      updatedRuns: 2,
      unsupportedCount: 1,
      warningCount: 1,
      lastAttemptedAt: "2026-03-21T00:00:00.000Z",
    });
    expect("eventId" in result).toBe(false);
  });
});
