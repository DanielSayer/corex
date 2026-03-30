import { describe, expect, it } from "bun:test";

import { normalizeActivityStreamForStorage } from "./stream-normalization";

describe("activity stream normalization", () => {
  it("doubles cadence stream samples before storage", () => {
    expect(
      normalizeActivityStreamForStorage({
        type: "cadence",
        data: [82, 83, 84, null],
      }),
    ).toEqual({
      type: "cadence",
      data: [164, 166, 168, null],
    });
  });

  it("leaves non-cadence streams unchanged", () => {
    const stream = {
      type: "heartrate",
      data: [120, 130, 140],
    };

    expect(normalizeActivityStreamForStorage(stream)).toBe(stream);
  });
});
