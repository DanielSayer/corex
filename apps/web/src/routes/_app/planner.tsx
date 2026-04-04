import { createFileRoute } from "@tanstack/react-router";

import { PlannerPage } from "@/components/planner";
import { ensureAppRouteAccess } from "@/lib/app-route";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_app/planner")({
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
  component: RouteComponent,
});

function RouteComponent() {
  const { data, isLoading } = useQuery(
    trpc.weeklyPlanning.getState.queryOptions(),
  );

  if (isLoading || !data) {
    return <p>Loading planner state...</p>;
  }

  return <PlannerPage plannerForm={data} />;
}
