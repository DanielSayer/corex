import type { WeeklyPlanDraft } from "@corex/api/weekly-planning/contracts";

import { Badge } from "@corex/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";

type PlannerDraftViewProps = {
  draft: WeeklyPlanDraft;
};

export function PlannerDraftView(props: PlannerDraftViewProps) {
  const draft = props.draft;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active draft</CardTitle>
        <CardDescription>
          Phase 5 keeps one active draft. Editing and regeneration land in phase
          6, so the current draft is read-only for now.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{draft.startDate}</Badge>
          <Badge variant="outline">{draft.endDate}</Badge>
          <Badge variant="outline">{draft.generationContext.longRunDay}</Badge>
        </div>

        <div className="grid gap-3">
          {draft.payload.days.map((day) => (
            <Card key={day.date} size="sm">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{day.date}</span>
                  <Badge variant="secondary">
                    {day.session?.sessionType ?? "rest"}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {day.session?.summary ?? "Recovery / no scheduled session"}
                </CardDescription>
              </CardHeader>
              {day.session ? (
                <CardContent className="grid gap-2">
                  <div className="text-sm font-medium">{day.session.title}</div>
                  <div className="text-sm text-muted-foreground">
                    Duration:{" "}
                    {Math.round(day.session.estimatedDurationSeconds / 60)} min
                  </div>
                  <div className="grid gap-2">
                    {day.session.intervalBlocks.map((block) => (
                      <div
                        key={`${day.date}-${block.order}`}
                        className="rounded-xl border border-border/70 px-3 py-2 text-sm"
                      >
                        <div className="font-medium">
                          {block.order}. {block.title}
                        </div>
                        <div className="text-muted-foreground">
                          {block.target.durationSeconds
                            ? `${Math.round(block.target.durationSeconds / 60)} min`
                            : null}
                          {block.target.distanceMeters
                            ? ` ${Math.round(block.target.distanceMeters)} m`
                            : null}
                          {block.target.heartRate
                            ? ` ${block.target.heartRate}`
                            : null}
                          {block.target.rpe ? ` RPE ${block.target.rpe}` : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
