import { describe, expect, it } from "vitest";

import { createApp } from "./app";

describe("createApp", () => {
  it("responds to the root health endpoint", async () => {
    const response = await createApp().request("http://localhost/");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("OK");
  });

  it("serves the public tRPC health check over HTTP", async () => {
    const response = await createApp().request("http://localhost/trpc/healthCheck");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("OK");
  });
});
