import {
  ActivityPreview,
  ActivityPreviewSkeleton,
} from "@/components/dashboard/activity-preview";
import {
  GoalProgressPanel,
  GoalProgressPanelSkeleton,
} from "@/components/dashboard/goal-progress-panel";
import { IntervalsSyncPanel } from "@/components/intervals-sync-panel";
import { LoadingWrapper } from "@/components/renderers";
import { Separator } from "@corex/ui/components/separator";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ensureAppRouteAccess } from "@/lib/app-route";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/dashboard")({
  component: RouteComponent,
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const privateData = useQuery(trpc.privateData.queryOptions());
  const goalProgress = useQuery(trpc.goalProgress.get.queryOptions());
  const recentActivities = useQuery(
    trpc.activityHistory.recentActivities.queryOptions(),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-12 md:px-8">
      <section className="grid gap-8 border-b border-border/70 pb-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-end">
        <div className="flex flex-col gap-5">
          <div className="space-y-3">
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Dashboard
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              Welcome {session.data?.user.name}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground">
              Re-run your Intervals import, inspect the latest history pulled
              into corex, and keep your training setup moving without digging
              through panels.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-l border-border/70 pl-5">
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                API
              </div>
              <p className="text-sm text-foreground">
                {privateData.data?.message ?? "Loading private data"}
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                Focus
              </div>
              <p className="text-sm text-muted-foreground">
                Sync history, recent activity, and setup flow
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:pl-6">
          <div>
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Recent activities
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Last 5 imported runs
            </h2>
            <p className="text-sm text-muted-foreground">
              A quick look at the latest Intervals activity history in corex.
            </p>
          </div>
          <Separator />

          <LoadingWrapper
            isLoading={recentActivities.isLoading}
            fallback={<ActivityPreviewSkeleton />}
          >
            <ActivityPreview activities={recentActivities.data ?? []} />
          </LoadingWrapper>
        </div>
      </section>

      <LoadingWrapper
        isLoading={goalProgress.isLoading}
        fallback={<GoalProgressPanelSkeleton />}
      >
        {goalProgress.data ? (
          <GoalProgressPanel goalProgress={goalProgress.data} />
        ) : null}
      </LoadingWrapper>

      <IntervalsSyncPanel
        title="Intervals history"
        description="Re-run your Intervals import from the dashboard at any time. The summary below shows how many runs were processed and what date range is currently covered."
      />
    </main>
  );
}
