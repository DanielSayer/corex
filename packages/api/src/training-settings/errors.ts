import { Data } from "effect";

export class Unauthenticated extends Data.TaggedError("Unauthenticated")<{
  message: string;
}> {}

export class InvalidSettings extends Data.TaggedError("InvalidSettings")<{
  message: string;
}> {}

export class InvalidApiKeyFormat extends Data.TaggedError(
  "InvalidApiKeyFormat",
)<{
  message: string;
}> {}

export class EncryptionFailure extends Data.TaggedError("EncryptionFailure")<{
  message: string;
  cause?: unknown;
}> {}

export class PersistenceFailure extends Data.TaggedError("PersistenceFailure")<{
  message: string;
  cause?: unknown;
}> {}

export type TrainingSettingsError =
  | InvalidApiKeyFormat
  | InvalidSettings
  | EncryptionFailure
  | PersistenceFailure
  | Unauthenticated;
