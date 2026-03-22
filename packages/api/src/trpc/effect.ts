import { Cause, Effect, Exit, Option } from "effect";

export async function executeEffect<A>(
  effect: Effect.Effect<A, unknown>,
  mapError: (error: unknown) => Error,
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);

  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const failure = Cause.failureOption(exit.cause);

  if (Option.isSome(failure)) {
    throw mapError(failure.value);
  }

  throw mapError(exit.cause);
}
