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
});
