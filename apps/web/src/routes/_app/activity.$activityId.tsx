import { ActivityDetailView } from "@/components/activities";
import { authClient } from "@/lib/auth-client";
import { LoadingWrapper } from "@/components/renderers";
import { trpc } from "@/utils/trpc";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/activity/$activityId")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }

    return { session };
  },
});

function RouteComponent() {
  const { activityId } = Route.useParams();
  const activitySummaryQuery = useQuery(
    trpc.activityHistory.activitySummary.queryOptions({ activityId }),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-4 py-4">
      <LoadingWrapper isLoading={activitySummaryQuery.isLoading}>
        {activitySummaryQuery.isError ? (
          <p className="text-destructive text-sm">Failed to load activity.</p>
        ) : activitySummaryQuery.data ? (
          <ActivityDetailView
            activity={activitySummaryQuery.data}
            activityId={activityId}
          />
        ) : null}
      </LoadingWrapper>
    </div>
  );
}
