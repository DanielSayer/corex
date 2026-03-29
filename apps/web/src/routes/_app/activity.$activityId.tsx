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
  const activityQuery = useQuery(
    trpc.intervalsSync.activityDetails.queryOptions({ activityId }),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-4 py-4">
      <LoadingWrapper isLoading={activityQuery.isLoading}>
        {activityQuery.isError ? (
          <p className="text-destructive text-sm">Failed to load activity.</p>
        ) : activityQuery.data ? (
          <ActivityDetailView activity={activityQuery.data} />
        ) : null}
      </LoadingWrapper>
    </div>
  );
}
