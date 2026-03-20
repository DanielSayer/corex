import { auth, type Auth } from "@corex/auth";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

export function createContextFactory({
  auth: authInstance = auth,
}: { auth?: Auth } = {}) {
  return async function createContext({ context }: CreateContextOptions) {
    const session = await authInstance.api.getSession({
      headers: context.req.raw.headers,
    });

    return {
      auth: null,
      session,
    };
  };
}

export const createContext = createContextFactory();

export type Context = Awaited<
  ReturnType<ReturnType<typeof createContextFactory>>
>;
