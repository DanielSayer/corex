import type { RouterAppContext } from "@/routes/__root";
import { redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export async function ensureAppRouteAccess(context: RouterAppContext) {
  const session = await authClient.getSession();

  if (!session.data) {
    redirect({
      to: "/login",
      throw: true,
    });
  }

  const settings = await context.queryClient.ensureQueryData(
    context.trpc.trainingSettings.get.queryOptions(),
  );

  if (settings.status !== "complete") {
    redirect({
      to: "/onboarding",
      throw: true,
    });
  }

  return { session };
}
