import { describe, expect, it } from "bun:test";
import { TRPCError } from "@trpc/server";

import { getPrivateData } from "./private-data";

describe("getPrivateData", () => {
  it("rejects missing sessions", () => {
    expect(() => getPrivateData(null)).toThrow("Authentication required");
  });

  it("returns the app-owned response shape for authenticated sessions", () => {
    expect(
      getPrivateData({
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
      }),
    ).toEqual({
      message: "This is private",
      user: {
        id: "user-1",
        email: "runner@example.com",
        name: "Runner One",
      },
    });
  });
});
