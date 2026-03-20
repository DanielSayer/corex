import { describe, expect, it } from "bun:test";

import { createHttpApp } from "./helpers/http";

describe("http integration", () => {
  it("serves the root health endpoint", async () => {
    const response = await createHttpApp(null).request("http://localhost/");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("rejects protected data without a session", async () => {
    const response = await createHttpApp(null).request(
      "http://localhost/trpc/privateData",
    );
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).toContain("Authentication required");
  });

  it("returns protected data when the transport receives an authenticated session", async () => {
    const response = await createHttpApp({
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
    }).request("http://localhost/trpc/privateData");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("This is private");
    expect(body).toContain("runner@example.com");
  });
});
