import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";

import { PlannerContextRow } from "./planner-context-row";

type PlannerHeaderProps = {
  planGoalCount: number;
  meetsSnapshotThreshold: boolean;
  hasRecentSync: boolean;
  hasActiveDraft: boolean;
};

export function PlannerHeader(props: PlannerHeaderProps) {
  return (
    <section className="grid gap-6 border-b border-border/70 pb-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <div className="space-y-4">
        <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Weekly planner
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Generate the next training week
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          corex uses your selected training-plan intent, availability, and
          synced running history to draft one structured week. Editing and
          regeneration stay out of scope until phase 6, so this page will hold a
          single active draft at a time.
        </p>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Planner context</CardTitle>
          <CardDescription>
            Stored setup and history signals used before the model runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <PlannerContextRow
            label="Plan goals"
            value={String(props.planGoalCount)}
          />
          <PlannerContextRow
            label="History threshold"
            value={props.meetsSnapshotThreshold ? "Met" : "Below"}
          />
          <PlannerContextRow
            label="Recent sync"
            value={props.hasRecentSync ? "Fresh" : "Stale"}
          />
          <PlannerContextRow
            label="Active draft"
            value={props.hasActiveDraft ? "Present" : "None"}
          />
        </CardContent>
      </Card>
    </section>
  );
}
