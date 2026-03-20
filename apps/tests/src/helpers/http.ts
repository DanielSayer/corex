import type { AppSession } from "@corex/api/application/types";
import type { Auth } from "@corex/auth";

import { createApp } from "server";

type StubAuthOptions = {
  session: AppSession | null;
};

export function createStubAuth(options: StubAuthOptions) {
  return {
    api: {
      async getSession() {
        return options.session;
      },
    },
    async handler() {
      return new Response("Not Found", {
        status: 404,
      });
    },
  } as unknown as Auth;
}

export function createHttpApp(session: AppSession | null) {
  return createApp({
    auth: createStubAuth({ session }),
    corsOrigin: process.env.CORS_ORIGIN ?? "http://127.0.0.1:3001",
  });
}
