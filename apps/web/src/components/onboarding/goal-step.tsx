import { Calendar } from "@corex/ui/components/calendar";
import { Input } from "@corex/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@corex/ui/components/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@corex/ui/components/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@corex/ui/components/select";
import { Textarea } from "@corex/ui/components/textarea";
import { format, parseISO } from "date-fns";
import { CalendarIcon, FlagIcon, RouteIcon, TimerIcon } from "lucide-react";

import type { GoalDraft, StepErrors } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import {
  FieldBlock,
  FieldError,
  LargeToggleGroup,
  SelectionTile,
} from "./shared";

export function GoalStep({
  draft,
  errors,
  onChange,
}: {
  draft: GoalDraft;
  errors: StepErrors;
  onChange: (goal: GoalDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <GoalTypeSelector draft={draft} onChange={onChange} />
      <GoalFields draft={draft} errors={errors} onChange={onChange} />
      <FieldError error={errors["goal.form"]} />
    </div>
  );
}

function GoalTypeSelector({
  draft,
  onChange,
}: {
  draft: GoalDraft;
  onChange: (goal: GoalDraft) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SelectionTile
        title="Event goal"
        description="Train toward a race or target effort on a specific date."
        icon={FlagIcon}
        selected={draft.type === "event_goal"}
        onClick={() => onChange(createEventGoalDraft(draft))}
      />
      <SelectionTile
        title="Volume goal"
        description="Train toward a recurring weekly or monthly mileage target."
        icon={RouteIcon}
        selected={draft.type === "volume_goal"}
        onClick={() => onChange(createVolumeGoalDraft())}
      />
    </div>
  );
}

function GoalFields({
  draft,
  errors,
  onChange,
}: {
  draft: GoalDraft;
  errors: StepErrors;
  onChange: (goal: GoalDraft) => void;
}) {
  switch (draft.type) {
    case "event_goal":
      return (
        <EventGoalFields draft={draft} errors={errors} onChange={onChange} />
      );
    case "volume_goal":
      return (
        <VolumeGoalFields draft={draft} errors={errors} onChange={onChange} />
      );
  }
}

function EventGoalFields({
  draft,
  errors,
  onChange,
}: {
  draft: Extract<GoalDraft, { type: "event_goal" }>;
  errors: StepErrors;
  onChange: (goal: GoalDraft) => void;
}) {
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
      <FieldBlock
        label="Target distance"
        error={errors["goal.targetDistanceValue"]}
      >
        <InputGroup>
          <InputGroupInput
            inputMode="decimal"
            value={draft.targetDistanceValue}
            aria-invalid={Boolean(errors["goal.targetDistanceValue"])}
            onChange={(event) =>
              onChange({
                ...draft,
                targetDistanceValue: event.target.value,
              })
            }
          />
          <InputGroupAddon align="inline-end" className="pr-1.5">
            <Select
              value={draft.targetDistanceUnit}
              onValueChange={(nextValue) =>
                onChange({
                  ...draft,
                  targetDistanceUnit: nextValue as "km" | "mi",
                })
              }
            >
              <SelectTrigger className="h-8 w-32 border-0 bg-transparent rounded-l-none shadow-none focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="km">Kilometres</SelectItem>
                  <SelectItem value="mi">Miles</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </InputGroupAddon>
        </InputGroup>
      </FieldBlock>

      <FieldBlock label="Target date" error={errors["goal.targetDate"]}>
        <EventGoalDatePicker
          value={draft.targetDate}
          invalid={Boolean(errors["goal.targetDate"])}
          onChange={(targetDate) =>
            onChange({
              ...draft,
              targetDate,
            })
          }
        />
      </FieldBlock>

      <FieldBlock label="Event name">
        <Input
          placeholder="London marathon"
          value={draft.eventName}
          onChange={(event) =>
            onChange({
              ...draft,
              eventName: event.target.value,
            })
          }
        />
      </FieldBlock>

      <FieldBlock
        label="Optional target time"
        error={errors["goal.targetTime"]}
        className="md:col-span-2"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            aria-invalid={Boolean(errors["goal.targetTime"])}
            inputMode="numeric"
            placeholder="Hours"
            value={draft.targetTimeHours}
            onChange={(event) =>
              onChange({
                ...draft,
                targetTimeHours: event.target.value,
              })
            }
          />
          <Input
            aria-invalid={Boolean(errors["goal.targetTime"])}
            inputMode="numeric"
            placeholder="Minutes"
            value={draft.targetTimeMinutes}
            onChange={(event) =>
              onChange({
                ...draft,
                targetTimeMinutes: event.target.value,
              })
            }
          />
          <Input
            aria-invalid={Boolean(errors["goal.targetTime"])}
            inputMode="numeric"
            placeholder="Seconds"
            value={draft.targetTimeSeconds}
            onChange={(event) =>
              onChange({
                ...draft,
                targetTimeSeconds: event.target.value,
              })
            }
          />
        </div>
      </FieldBlock>

      <FieldBlock label="Notes" className="md:col-span-2">
        <Textarea
          placeholder="Running this with friends..."
          value={draft.notes}
          onChange={(event) =>
            onChange({
              ...draft,
              notes: event.target.value,
            })
          }
        />
      </FieldBlock>
    </div>
  );
}

function VolumeGoalFields({
  draft,
  errors,
  onChange,
}: {
  draft: Extract<GoalDraft, { type: "volume_goal" }>;
  errors: StepErrors;
  onChange: (goal: GoalDraft) => void;
}) {
  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
      <FieldBlock label="Metric">
        <LargeToggleGroup
          value={draft.metric}
          options={[
            { value: "distance", label: "Distance", icon: RouteIcon },
            { value: "time", label: "Time", icon: TimerIcon },
          ]}
          onChange={(nextValue) =>
            onChange({
              ...draft,
              metric: nextValue as "distance" | "time",
              unit: nextValue === "time" ? "minutes" : "km",
            })
          }
        />
      </FieldBlock>

      <FieldBlock label="Period">
        <LargeToggleGroup
          value={draft.period}
          options={[
            { value: "week", label: "Per week" },
            { value: "month", label: "Per month" },
          ]}
          onChange={(nextValue) =>
            onChange({
              ...draft,
              period: nextValue as "week" | "month",
            })
          }
        />
      </FieldBlock>

      <FieldBlock label="Target value" error={errors["goal.targetValue"]}>
        <VolumeTargetValueField
          draft={draft}
          error={errors["goal.targetValue"]}
          onChange={onChange}
        />
      </FieldBlock>

      <FieldBlock label="Notes" className="md:col-span-2">
        <Textarea
          placeholder="Build back toward a consistent 5-day routine..."
          value={draft.notes}
          onChange={(event) =>
            onChange({
              ...draft,
              notes: event.target.value,
            })
          }
        />
      </FieldBlock>
    </div>
  );
}

function VolumeTargetValueField({
  draft,
  error,
  onChange,
}: {
  draft: Extract<GoalDraft, { type: "volume_goal" }>;
  error?: string;
  onChange: (goal: GoalDraft) => void;
}) {
  return (
    <InputGroup>
      <InputGroupInput
        inputMode="decimal"
        value={draft.targetValue}
        aria-invalid={Boolean(error)}
        onChange={(event) =>
          onChange({
            ...draft,
            targetValue: event.target.value,
          })
        }
      />
      <InputGroupAddon align="inline-end" className="pr-1.5">
        {draft.metric === "time" ? (
          <span className="px-3 text-sm text-muted-foreground">minutes</span>
        ) : (
          <Select
            value={draft.unit}
            onValueChange={(nextValue) =>
              onChange({
                ...draft,
                unit: nextValue as "km" | "mi",
              })
            }
          >
            <SelectTrigger className="h-8 w-32 border-0 bg-transparent rounded-l-none shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="km">Kilometres</SelectItem>
                <SelectItem value="mi">Miles</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}

function createEventGoalDraft(
  currentGoal: GoalDraft,
): Extract<GoalDraft, { type: "event_goal" }> {
  return {
    type: "event_goal",
    targetDistanceValue: "10",
    targetDistanceUnit: "km",
    targetDate: currentGoal.type === "event_goal" ? currentGoal.targetDate : "",
    eventName: "",
    targetTimeHours: "",
    targetTimeMinutes: "",
    targetTimeSeconds: "",
    notes: "",
  };
}

function createVolumeGoalDraft(): Extract<GoalDraft, { type: "volume_goal" }> {
  return {
    type: "volume_goal",
    metric: "distance",
    period: "week",
    targetValue: "40",
    unit: "km",
    notes: "",
  };
}

function EventGoalDatePicker({
  value,
  invalid,
  onChange,
}: {
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger
        aria-invalid={invalid}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-4xl border border-input bg-input/30 px-3 py-1 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
          !selectedDate && "text-muted-foreground",
        )}
      >
        <span>
          {selectedDate ? format(selectedDate, "PPP") : "Pick a target date"}
        </span>
        <CalendarIcon data-icon="inline-end" className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
        />
      </PopoverContent>
    </Popover>
  );
}
