import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { EncryptionFailure } from "../training-settings/errors";
import { createIntervalsAccountPort } from "./account";
import type { IntervalsAccountStore } from "./account-repository";

function createStore(
  overrides: Partial<IntervalsAccountStore> = {},
): IntervalsAccountStore {
  return {
    findAccountByUserId: () =>
      Effect.succeed({
        username: "runner@example.com",
        athleteId: null,
        ciphertext: "ciphertext",
        iv: "iv",
        tag: "tag",
        keyVersion: 1,
      }),
    saveAthleteIdentity: () => Effect.void,
    ...overrides,
  };
}

describe("intervals account service", () => {
  it("loads decrypted account credentials for a user", async () => {
    const service = createIntervalsAccountPort({
      store: createStore(),
      crypto: {
        encrypt: () => Effect.die("not used"),
        decrypt: () => Effect.succeed("intervals-secret"),
      },
    });

    await expect(Effect.runPromise(service.load("user-1"))).resolves.toEqual({
      username: "runner@example.com",
      apiKey: "intervals-secret",
      athleteId: null,
    });
  });

  it("persists resolved athlete identity through the account boundary", async () => {
    let persisted:
      | Parameters<IntervalsAccountStore["saveAthleteIdentity"]>[1]
      | undefined;

    const service = createIntervalsAccountPort({
      store: createStore({
        saveAthleteIdentity: (_userId, identity) => {
          persisted = identity;
          return Effect.void;
        },
      }),
      crypto: {
        encrypt: () => Effect.die("not used"),
        decrypt: () => Effect.succeed("intervals-secret"),
      },
    });

    await Effect.runPromise(
      service.saveResolvedAthlete("user-1", {
        athleteId: "i509216",
        resolvedAt: new Date("2026-03-21T00:00:00.000Z"),
      }),
    );

    expect(persisted).toEqual({
      athleteId: "i509216",
      resolvedAt: new Date("2026-03-21T00:00:00.000Z"),
    });
  });

  it("maps credential decryption failures to intervals persistence failures", async () => {
    const service = createIntervalsAccountPort({
      store: createStore(),
      crypto: {
        encrypt: () => Effect.die("not used"),
        decrypt: () =>
          Effect.fail(
            new EncryptionFailure({
              message: "Failed to decrypt Intervals API key",
            }),
          ),
      },
    });

    await expect(
      Effect.runPromise(service.load("user-1")),
    ).rejects.toMatchObject({
      message: "Failed to decrypt Intervals API key",
    });
  });
});
