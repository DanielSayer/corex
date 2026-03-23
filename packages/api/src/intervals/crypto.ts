import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Effect } from "effect";

import { EncryptionFailure } from "../training-settings/errors";

export type EncryptedCredential = {
  ciphertext: string;
  iv: string;
  tag: string;
  keyVersion: number;
};

export type CredentialCrypto = {
  encrypt: (
    userId: string,
    plaintext: string,
  ) => Effect.Effect<EncryptedCredential, EncryptionFailure>;
  decrypt: (
    userId: string,
    encrypted: EncryptedCredential,
  ) => Effect.Effect<string, EncryptionFailure>;
};

type CreateCredentialCryptoOptions = {
  masterKeyBase64: string;
  keyVersion: number;
};

const algorithm = "aes-256-gcm";

function createAad(userId: string) {
  return Buffer.from(`training-settings:intervals-api-key:${userId}`, "utf8");
}

function decodeMasterKey(masterKeyBase64: string) {
  return Effect.try({
    try: () => {
      const trimmedKey = masterKeyBase64.trim();
      const decodedBase64Key = Buffer.from(trimmedKey, "base64");

      if (decodedBase64Key.length === 32) {
        return decodedBase64Key;
      }

      const rawKey = Buffer.from(trimmedKey, "utf8");

      if (rawKey.length === 32) {
        return rawKey;
      }

      throw new Error(
        "Settings master key must be base64 for 32 bytes or a raw 32-byte string",
      );
    },
    catch: (cause) =>
      new EncryptionFailure({
        message: "Invalid settings master key configuration",
        cause,
      }),
  });
}

export function createCredentialCrypto(
  options: CreateCredentialCryptoOptions,
): CredentialCrypto {
  const keyEffect = decodeMasterKey(options.masterKeyBase64);

  return {
    encrypt(userId, plaintext) {
      return Effect.flatMap(keyEffect, (key) =>
        Effect.try({
          try: () => {
            const iv = randomBytes(12);
            const cipher = createCipheriv(algorithm, key, iv);

            cipher.setAAD(createAad(userId));

            const ciphertext = Buffer.concat([
              cipher.update(plaintext, "utf8"),
              cipher.final(),
            ]);
            const tag = cipher.getAuthTag();

            return {
              ciphertext: ciphertext.toString("base64"),
              iv: iv.toString("base64"),
              tag: tag.toString("base64"),
              keyVersion: options.keyVersion,
            };
          },
          catch: (cause) =>
            new EncryptionFailure({
              message: "Failed to encrypt Intervals API key",
              cause,
            }),
        }),
      );
    },
    decrypt(userId, encrypted) {
      return Effect.flatMap(keyEffect, (key) =>
        Effect.try({
          try: () => {
            const decipher = createDecipheriv(
              algorithm,
              key,
              Buffer.from(encrypted.iv, "base64"),
            );

            decipher.setAAD(createAad(userId));
            decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));

            const plaintext = Buffer.concat([
              decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
              decipher.final(),
            ]);

            return plaintext.toString("utf8");
          },
          catch: (cause) =>
            new EncryptionFailure({
              message: "Failed to decrypt Intervals API key",
              cause,
            }),
        }),
      );
    },
  };
}
