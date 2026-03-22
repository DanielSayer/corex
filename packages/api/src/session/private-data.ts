import { TRPCError } from "@trpc/server";

import type { AppSession } from "./types";

export function getPrivateData(session: AppSession | null) {
  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }

  return {
    message: "This is private",
    user: session.user,
  };
}
