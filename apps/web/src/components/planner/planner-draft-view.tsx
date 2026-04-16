import { useState } from "react";

import type { WeeklyPlanDraft } from "@corex/api/weekly-planning/contracts";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@corex/ui/components/alert";
import { Badge } from "@corex/ui/components/badge";
import { Button } from "@corex/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@corex/ui/components/card";
import { Input } from "@corex/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@corex/ui/components/select";
import { Textarea } from "@corex/ui/components/textarea";

import { formatLongRunDayLabel } from "@/lib/planner";
import { PlannerField } from "./planner-field";

type PlannedSession = NonNullable<
  WeeklyPlanDraft["payload"]["days"][number]["session"]
>;
type IntervalBlock = PlannedSession["intervalBlocks"][number];

type EditableTarget = {
  durationMinutes: string;
  distanceMeters: string;
  pace: string;
  heartRate: string;
  rpe: string;
};

type EditableIntervalBlock = {
  blockType: IntervalBlock["blockType"];
  repetitions: string;
  title: string;
  notes: string;
  target: EditableTarget;
};

type EditableSession = {
  sessionType: PlannedSession["sessionType"];
  title: string;
  summary: string;
  coachingNotes: string;
  estimatedDurationMinutes: string;
  estimatedDistanceMeters: string;
  intervalBlocks: EditableIntervalBlock[];
};

type PlannerDraftViewProps = {
  draft: WeeklyPlanDraft;
  errorMessage: string | null;
  isUpdating: boolean;
  isMoving: boolean;
  isRegenerating: boolean;
  onUpdateSession: (input: { date: string; session: PlannedSession }) => void;
  onMoveSession: (input: {
    fromDate: string;
    toDate: string;
    mode: "move" | "swap";
  }) => void;
  onRegenerate: () => void;
};

function minutesFromSeconds(seconds: number | null) {
  return seconds == null ? "" : String(Math.round(seconds / 60));
}

function numberOrNull(value: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrFallback(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toEditableSession(session: PlannedSession): EditableSession {
  return {
    sessionType: session.sessionType,
    title: session.title,
    summary: session.summary,
    coachingNotes: session.coachingNotes ?? "",
    estimatedDurationMinutes: minutesFromSeconds(
      session.estimatedDurationSeconds,
    ),
    estimatedDistanceMeters:
      session.estimatedDistanceMeters == null
        ? ""
        : String(Math.round(session.estimatedDistanceMeters)),
    intervalBlocks: session.intervalBlocks.map((block) => ({
      blockType: block.blockType,
      repetitions: String(block.repetitions),
      title: block.title,
      notes: block.notes ?? "",
      target: {
        durationMinutes: minutesFromSeconds(block.target.durationSeconds),
        distanceMeters:
          block.target.distanceMeters == null
            ? ""
            : String(Math.round(block.target.distanceMeters)),
        pace: block.target.pace ?? "",
        heartRate: block.target.heartRate ?? "",
        rpe: block.target.rpe == null ? "" : String(block.target.rpe),
      },
    })),
  };
}

function toPlannedSession(form: EditableSession): PlannedSession {
  return {
    sessionType: form.sessionType,
    title: form.title,
    summary: form.summary,
    coachingNotes:
      form.coachingNotes.trim().length === 0 ? null : form.coachingNotes,
    estimatedDurationSeconds: Math.max(
      0,
      intOrFallback(form.estimatedDurationMinutes, 0) * 60,
    ),
    estimatedDistanceMeters: numberOrNull(form.estimatedDistanceMeters),
    intervalBlocks: form.intervalBlocks.map((block, index) => ({
      blockType: block.blockType,
      order: index + 1,
      repetitions: Math.max(1, intOrFallback(block.repetitions, 1)),
      title: block.title,
      notes: block.notes.trim().length === 0 ? null : block.notes,
      target: {
        durationSeconds:
          block.target.durationMinutes.trim().length === 0
            ? null
            : Math.max(1, intOrFallback(block.target.durationMinutes, 1) * 60),
        distanceMeters: numberOrNull(block.target.distanceMeters),
        pace: block.target.pace.trim().length === 0 ? null : block.target.pace,
        heartRate:
          block.target.heartRate.trim().length === 0
            ? null
            : block.target.heartRate,
        rpe:
          block.target.rpe.trim().length === 0
            ? null
            : Math.max(1, Math.min(10, intOrFallback(block.target.rpe, 1))),
      },
    })),
  };
}

function sessionLabel(session: PlannedSession | null) {
  return session?.title ?? "Rest day";
}

function getVisibleQualityItems(draft: WeeklyPlanDraft) {
  const report = draft.qualityReport;

  if (!report || report.status === "pass") {
    return [];
  }

  return [...report.items]
    .sort((left, right) => {
      if (left.severity === right.severity) {
        return 0;
      }

      return left.severity === "blocking" ? -1 : 1;
    })
    .slice(0, 5);
}

export function PlannerDraftView(props: PlannerDraftViewProps) {
  const draft = props.draft;
  const planGoal = draft.generationContext.plannerIntent.planGoal;
  const qualityItems = getVisibleQualityItems(draft);
  const [formsByDate, setFormsByDate] = useState<
    Record<string, EditableSession>
  >(() =>
    Object.fromEntries(
      draft.payload.days.flatMap((day) =>
        day.session ? [[day.date, toEditableSession(day.session)]] : [],
      ),
    ),
  );
  const [moveTargetsByDate, setMoveTargetsByDate] = useState<
    Record<string, string>
  >({});
  const [moveModesByDate, setMoveModesByDate] = useState<
    Record<string, "move" | "swap">
  >({});

  const updateForm = (
    date: string,
    updater: (current: EditableSession) => EditableSession,
  ) => {
    setFormsByDate((current) => {
      const form = current[date];

      if (!form) {
        return current;
      }

      return {
        ...current,
        [date]: updater(form),
      };
    });
  };

  const updateBlock = (
    date: string,
    index: number,
    updater: (current: EditableIntervalBlock) => EditableIntervalBlock,
  ) => {
    updateForm(date, (current) => ({
      ...current,
      intervalBlocks: current.intervalBlocks.map((block, blockIndex) =>
        blockIndex === index ? updater(block) : block,
      ),
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <span>Active draft</span>
          <Button
            disabled={props.isRegenerating}
            onClick={props.onRegenerate}
            variant="outline"
          >
            {props.isRegenerating ? "Regenerating..." : "Regenerate draft"}
          </Button>
        </CardTitle>
        <CardDescription>
          Adjust sessions, move work inside this seven-day window, or replace
          the draft with a fresh generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{draft.startDate}</Badge>
          <Badge variant="outline">{draft.endDate}</Badge>
          <Badge variant="outline">{planGoal}</Badge>
          <Badge variant="outline">
            {formatLongRunDayLabel(draft.generationContext.longRunDay)}
          </Badge>
        </div>

        {props.errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Draft update failed</AlertTitle>
            <AlertDescription>{props.errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {draft.qualityReport && qualityItems.length > 0 ? (
          <Alert
            variant={
              draft.qualityReport.status === "blocked"
                ? "destructive"
                : "default"
            }
          >
            <AlertTitle>
              {draft.qualityReport.status === "blocked"
                ? "Plan quality risks"
                : "Plan quality warnings"}
            </AlertTitle>
            <AlertDescription>
              <div className="flex flex-col gap-2">
                <p>{draft.qualityReport.summary}</p>
                <ul className="list-disc space-y-1 pl-5">
                  {qualityItems.map((item) => (
                    <li key={item.code}>
                      <span className="font-medium">
                        {item.severity === "blocking" ? "Blocking" : "Warning"}:
                      </span>{" "}
                      {item.message}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          {draft.payload.days.map((day) => {
            const form = formsByDate[day.date];
            const moveTarget = moveTargetsByDate[day.date] ?? "";
            const moveMode = moveModesByDate[day.date] ?? "move";

            return (
              <Card key={day.date} size="sm">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                    <span>{day.date}</span>
                    <Badge variant="secondary">
                      {day.session?.sessionType ?? "rest"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {day.session?.summary ?? "Recovery / no scheduled session"}
                  </CardDescription>
                </CardHeader>
                {day.session && form ? (
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <PlannerField label="Session type">
                        <Select
                          value={form.sessionType}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            updateForm(day.date, (current) => ({
                              ...current,
                              sessionType:
                                value as EditableSession["sessionType"],
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="easy_run">Easy run</SelectItem>
                              <SelectItem value="long_run">Long run</SelectItem>
                              <SelectItem value="workout">Workout</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </PlannerField>

                      <PlannerField label="Title">
                        <Input
                          value={form.title}
                          onChange={(event) =>
                            updateForm(day.date, (current) => ({
                              ...current,
                              title: event.currentTarget.value,
                            }))
                          }
                        />
                      </PlannerField>

                      <PlannerField label="Summary">
                        <Textarea
                          value={form.summary}
                          onChange={(event) =>
                            updateForm(day.date, (current) => ({
                              ...current,
                              summary: event.currentTarget.value,
                            }))
                          }
                        />
                      </PlannerField>

                      <PlannerField label="Coaching notes">
                        <Textarea
                          value={form.coachingNotes}
                          onChange={(event) =>
                            updateForm(day.date, (current) => ({
                              ...current,
                              coachingNotes: event.currentTarget.value,
                            }))
                          }
                        />
                      </PlannerField>

                      <PlannerField label="Duration (minutes)">
                        <Input
                          min="0"
                          type="number"
                          value={form.estimatedDurationMinutes}
                          onChange={(event) =>
                            updateForm(day.date, (current) => ({
                              ...current,
                              estimatedDurationMinutes:
                                event.currentTarget.value,
                            }))
                          }
                        />
                      </PlannerField>

                      <PlannerField label="Distance (meters)">
                        <Input
                          min="0"
                          type="number"
                          value={form.estimatedDistanceMeters}
                          onChange={(event) =>
                            updateForm(day.date, (current) => ({
                              ...current,
                              estimatedDistanceMeters:
                                event.currentTarget.value,
                            }))
                          }
                        />
                      </PlannerField>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="text-sm font-medium">Interval blocks</div>
                      {form.intervalBlocks.map((block, index) => (
                        <div
                          className="grid gap-3 rounded-xl border border-border/70 p-3 md:grid-cols-3"
                          key={`${day.date}-${index}`}
                        >
                          <PlannerField label="Block type">
                            <Select
                              value={block.blockType}
                              onValueChange={(value) => {
                                if (!value) {
                                  return;
                                }

                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  blockType:
                                    value as EditableIntervalBlock["blockType"],
                                }));
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="warmup">Warmup</SelectItem>
                                  <SelectItem value="steady">Steady</SelectItem>
                                  <SelectItem value="work">Work</SelectItem>
                                  <SelectItem value="recovery">
                                    Recovery
                                  </SelectItem>
                                  <SelectItem value="cooldown">
                                    Cooldown
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </PlannerField>

                          <PlannerField label="Title">
                            <Input
                              value={block.title}
                              onChange={(event) =>
                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  title: event.currentTarget.value,
                                }))
                              }
                            />
                          </PlannerField>

                          <PlannerField label="Repetitions">
                            <Input
                              min="1"
                              type="number"
                              value={block.repetitions}
                              onChange={(event) =>
                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  repetitions: event.currentTarget.value,
                                }))
                              }
                            />
                          </PlannerField>

                          <PlannerField label="Target minutes">
                            <Input
                              min="0"
                              type="number"
                              value={block.target.durationMinutes}
                              onChange={(event) =>
                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  target: {
                                    ...current.target,
                                    durationMinutes: event.currentTarget.value,
                                  },
                                }))
                              }
                            />
                          </PlannerField>

                          <PlannerField label="Target meters">
                            <Input
                              min="0"
                              type="number"
                              value={block.target.distanceMeters}
                              onChange={(event) =>
                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  target: {
                                    ...current.target,
                                    distanceMeters: event.currentTarget.value,
                                  },
                                }))
                              }
                            />
                          </PlannerField>

                          <PlannerField label="RPE">
                            <Input
                              max="10"
                              min="1"
                              type="number"
                              value={block.target.rpe}
                              onChange={(event) =>
                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  target: {
                                    ...current.target,
                                    rpe: event.currentTarget.value,
                                  },
                                }))
                              }
                            />
                          </PlannerField>

                          <PlannerField label="Pace">
                            <Input
                              value={block.target.pace}
                              onChange={(event) =>
                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  target: {
                                    ...current.target,
                                    pace: event.currentTarget.value,
                                  },
                                }))
                              }
                            />
                          </PlannerField>

                          <PlannerField label="Heart rate">
                            <Input
                              value={block.target.heartRate}
                              onChange={(event) =>
                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  target: {
                                    ...current.target,
                                    heartRate: event.currentTarget.value,
                                  },
                                }))
                              }
                            />
                          </PlannerField>

                          <PlannerField label="Block notes">
                            <Textarea
                              value={block.notes}
                              onChange={(event) =>
                                updateBlock(day.date, index, (current) => ({
                                  ...current,
                                  notes: event.currentTarget.value,
                                }))
                              }
                            />
                          </PlannerField>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                      <PlannerField label="Move to">
                        <Select
                          value={moveTarget}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setMoveTargetsByDate((current) => ({
                              ...current,
                              [day.date]: value,
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full md:w-72">
                            <SelectValue placeholder="Select target day" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {draft.payload.days
                                .filter(
                                  (targetDay) => targetDay.date !== day.date,
                                )
                                .map((targetDay) => (
                                  <SelectItem
                                    key={targetDay.date}
                                    value={targetDay.date}
                                  >
                                    {targetDay.date} -{" "}
                                    {sessionLabel(targetDay.session)}
                                  </SelectItem>
                                ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </PlannerField>

                      <PlannerField label="Move mode">
                        <Select
                          value={moveMode}
                          onValueChange={(value) => {
                            if (!value) {
                              return;
                            }

                            setMoveModesByDate((current) => ({
                              ...current,
                              [day.date]: value as "move" | "swap",
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full md:w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="move">Move</SelectItem>
                              <SelectItem value="swap">Swap</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </PlannerField>

                      <Button
                        disabled={
                          props.isMoving ||
                          props.isUpdating ||
                          moveTarget.length === 0
                        }
                        onClick={() =>
                          props.onMoveSession({
                            fromDate: day.date,
                            toDate: moveTarget,
                            mode: moveMode,
                          })
                        }
                        variant="outline"
                      >
                        {props.isMoving ? "Moving..." : "Move session"}
                      </Button>

                      <Button
                        disabled={props.isUpdating}
                        onClick={() =>
                          props.onUpdateSession({
                            date: day.date,
                            session: toPlannedSession(form),
                          })
                        }
                      >
                        {props.isUpdating ? "Saving..." : "Save session"}
                      </Button>
                    </div>
                  </CardContent>
                ) : (
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      A scheduled session can be moved here from another day in
                      this draft.
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
