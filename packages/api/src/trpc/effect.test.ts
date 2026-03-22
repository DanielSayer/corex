import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { executeEffect } from "./effect";

describe("executeEffect", () => {
  it("returns successful effect values", async () => {
    await expect(
      executeEffect(Effect.succeed("OK"), () => new Error("unused")),
    ).resolves.toBe("OK");
  });

  it("maps failed effects through the provided translator", async () => {
    await expect(
      executeEffect(
        Effect.fail(new Error("bad input")),
        (error) => new TypeError(String((error as Error).message)),
      ),
    ).rejects.toEqual(new TypeError("bad input"));
  });
});
