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
