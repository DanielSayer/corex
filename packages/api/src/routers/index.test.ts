import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "bun:test";

import type { Context } from "../context";
import { appRouter } from "./index";

function createCallerContext(session: Context["session"]): Context {
  return {
    auth: null,
    session,
  };
}

describe("appRouter", () => {
  it("returns the public health check without a session", async () => {
    const caller = appRouter.createCaller(createCallerContext(null));

    await expect(caller.healthCheck()).resolves.toBe("OK");
  });

  it("rejects protected data without a session", async () => {
    const caller = appRouter.createCaller(createCallerContext(null));

    await expect(caller.privateData()).rejects.toBeInstanceOf(TRPCError);
  });

  it("returns protected data when a session is present", async () => {
    const caller = appRouter.createCaller(
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

    await expect(caller.privateData()).resolves.toMatchObject({
      message: "This is private",
      user: {
        id: "user-1",
        email: "runner@example.com",
      },
    });
  });
});
