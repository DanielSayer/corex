import { getHealthCheck } from "../application/queries/health-check";
import { getPrivateData } from "../application/queries/private-data";
import { publicProcedure, router } from "../index";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => getHealthCheck()),
  privateData: publicProcedure.query(({ ctx }) => getPrivateData(ctx.session)),
});
export type AppRouter = typeof appRouter;
