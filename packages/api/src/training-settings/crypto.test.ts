import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { EncryptionFailure } from "./errors";
import { createCredentialCrypto } from "./crypto";

const masterKeyBase64 = Buffer.alloc(32, 7).toString("base64");

describe("credential crypto", () => {
  it("encrypts and decrypts a credential round-trip", async () => {
    const crypto = createCredentialCrypto({
      masterKeyBase64,
      keyVersion: 1,
    });

    const encrypted = await Effect.runPromise(
      crypto.encrypt("user-1", "intervals-key"),
    );
    const decrypted = await Effect.runPromise(
      crypto.decrypt("user-1", encrypted),
    );

    expect(encrypted.ciphertext).not.toBe("intervals-key");
    expect(decrypted).toBe("intervals-key");
  });

  it("fails decryption when the credential is used for a different user", async () => {
    const crypto = createCredentialCrypto({
      masterKeyBase64,
      keyVersion: 1,
    });
    const encrypted = await Effect.runPromise(
      crypto.encrypt("user-1", "intervals-key"),
    );
    const exit = await Effect.runPromiseExit(
      crypto.decrypt("user-2", encrypted),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);

      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(EncryptionFailure);
      }
    }
  });

  it("accepts a raw 32-byte master key when encrypting intervals api keys", async () => {
    const crypto = createCredentialCrypto({
      masterKeyBase64: "ovF3PhO29PoeS9gxC5TDl3PqlD6Z2xli ",
      keyVersion: 1,
    });

    const encrypted = await Effect.runPromise(
      crypto.encrypt("user-1", "6cg3tnhpclayvep6s9jf8a02g"),
    );
    const decrypted = await Effect.runPromise(
      crypto.decrypt("user-1", encrypted),
    );

    expect(decrypted).toBe("6cg3tnhpclayvep6s9jf8a02g");
  });
});
