import { IntervalsSyncPanel } from "@/components/intervals-sync-panel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";

import { ensureAppRouteAccess } from "@/lib/app-route";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_app/dashboard")({
  component: RouteComponent,
  beforeLoad: ({ context }) => ensureAppRouteAccess(context),
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  const privateData = useQuery(trpc.privateData.queryOptions());

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 pb-12">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[2rem] border border-border/70 bg-card/60 shadow-none">
          <CardHeader className="gap-2">
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Dashboard
            </div>
            <CardTitle className="text-3xl tracking-tight">
              Welcome {session.data?.user.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              Use this screen to re-run your Intervals import whenever you need
              another test pass.
            </p>
            <p>API: {privateData.data?.message}</p>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border border-border/70 bg-card/60 shadow-none">
          <CardHeader className="gap-2">
            <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Testing shortcut
            </div>
            <CardTitle>Repeat syncs from here</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This stays available after onboarding so you do not need to rely on
            the one-time sync step during development.
          </CardContent>
        </Card>
      </section>

      <IntervalsSyncPanel
        title="Intervals history"
        description="Re-run your Intervals import from the dashboard at any time. The summary below shows how many runs were processed and what date range is currently covered."
      />
    </main>
  );
}
