import { createContextFactory } from "@corex/api/context";
import { appRouter, type AppRouter } from "@corex/api/routers";
import { auth, type Auth } from "@corex/auth";
import { env } from "@corex/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

type CreateAppOptions = {
  auth?: Auth;
  corsOrigin?: string;
  router?: AppRouter;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();
  const authInstance = options.auth ?? auth;
  const corsOrigin = options.corsOrigin ?? env.CORS_ORIGIN;
  const router = options.router ?? appRouter;
  const createContext = createContextFactory({
    auth: authInstance,
  });

  app.use(logger());
  app.use(
    "/*",
    cors({
      origin: corsOrigin,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.on(["POST", "GET"], "/api/auth/*", (c) =>
    authInstance.handler(c.req.raw),
  );

  app.use(
    "/trpc/*",
    trpcServer({
      router,
      createContext: (_opts, context) => {
        return createContext({ context });
      },
    }),
  );

  app.get("/", (c) => {
    return c.text("OK");
  });

  return app;
}
