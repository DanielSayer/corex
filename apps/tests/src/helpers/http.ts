import type { AppSession } from "@corex/api/application/types";
import type { AppRouter } from "@corex/api/routers";
import type { Auth } from "@corex/auth";
import { getServerTestEnv } from "@corex/env/test";

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
  return createHttpAppWithRouter(session);
}

export function createHttpAppWithRouter(
  session: AppSession | null,
  router?: AppRouter,
) {
  const env = getServerTestEnv();

  return createApp({
    auth: createStubAuth({ session }),
    corsOrigin: env.CORS_ORIGIN,
    router,
  });
}
