import { Button } from "@corex/ui/components/button";
import { Checkbox } from "@corex/ui/components/checkbox";
import { Label } from "@corex/ui/components/label";
import { Separator } from "@corex/ui/components/separator";
import { Slider } from "@corex/ui/components/slider";

import {
  availabilityDays,
  availabilityPresets,
  type AvailabilityDay,
  type OnboardingDraft,
  type StepErrors,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

import { dayLabels } from "./constants";
import { FieldError } from "./shared";

export function AvailabilityStep({
  availability,
  expandedDay,
  errors,
  onExpandedDayChange,
  onChange,
}: {
  availability: OnboardingDraft["availability"];
  expandedDay: AvailabilityDay;
  errors: StepErrors;
  onExpandedDayChange: (day: AvailabilityDay) => void;
  onChange: (availability: OnboardingDraft["availability"]) => void;
}) {
  const selectedDay = availability[expandedDay];

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <AvailabilityDayList
        availability={availability}
        expandedDay={expandedDay}
        onExpandedDayChange={onExpandedDayChange}
      />

      <AvailabilityDayEditor
        day={expandedDay}
        selectedDay={selectedDay}
        availability={availability}
        error={errors[`availability.${expandedDay}.maxDurationMinutes`]}
        onChange={onChange}
      />

      <FieldError error={errors["availability.form"]} />
    </div>
  );
}

function AvailabilityDayList({
  availability,
  expandedDay,
  onExpandedDayChange,
}: {
  availability: OnboardingDraft["availability"];
  expandedDay: AvailabilityDay;
  onExpandedDayChange: (day: AvailabilityDay) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label>Days of week</Label>
      <div className="flex flex-col gap-2">
        {availabilityDays.map((day) => (
          <AvailabilityDayButton
            key={day}
            day={day}
            isSelected={day === expandedDay}
            availability={availability[day]}
            onClick={() => onExpandedDayChange(day)}
          />
        ))}
      </div>
    </div>
  );
}

function AvailabilityDayButton({
  day,
  isSelected,
  availability,
  onClick,
}: {
  day: AvailabilityDay;
  isSelected: boolean;
  availability: OnboardingDraft["availability"][AvailabilityDay];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-3xl border px-4 py-4 text-left transition-colors",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border bg-card/20 hover:bg-card/35",
      )}
    >
      <span className="text-sm font-medium">{dayLabels[day]}</span>
      <span className="text-xs text-muted-foreground">
        {availability.available
          ? `${availability.maxDurationMinutes} min`
          : "Off"}
      </span>
    </button>
  );
}

function AvailabilityDayEditor({
  day,
  selectedDay,
  availability,
  error,
  onChange,
}: {
  day: AvailabilityDay;
  selectedDay: OnboardingDraft["availability"][AvailabilityDay];
  availability: OnboardingDraft["availability"];
  error?: string;
  onChange: (availability: OnboardingDraft["availability"]) => void;
}) {
  const updateSelectedDay = (
    nextDay: OnboardingDraft["availability"][AvailabilityDay],
  ) => {
    onChange({
      ...availability,
      [day]: nextDay,
    });
  };

  return (
    <div className="flex flex-col gap-6 rounded-4xl border border-border bg-card/25 px-6 py-6">
      <AvailabilityDayHeader
        day={day}
        selectedDay={selectedDay}
        onAvailabilityToggle={(checked) =>
          updateSelectedDay({
            ...selectedDay,
            available: checked,
          })
        }
      />

      <Separator />

      <AvailabilityDayDetails
        selectedDay={selectedDay}
        onDurationPresetSelect={(preset) =>
          updateSelectedDay({
            ...selectedDay,
            maxDurationMinutes: preset,
          })
        }
        onDurationChange={(nextValue) =>
          updateSelectedDay({
            ...selectedDay,
            maxDurationMinutes: nextValue,
          })
        }
      />

      <FieldError error={error} />
    </div>
  );
}

function AvailabilityDayHeader({
  day,
  selectedDay,
  onAvailabilityToggle,
}: {
  day: AvailabilityDay;
  selectedDay: OnboardingDraft["availability"][AvailabilityDay];
  onAvailabilityToggle: (checked: boolean) => void;
}) {
  const description = selectedDay.available
    ? "Set the maximum time you want to run on this day."
    : "Mark this day on when you want it included in the plan.";

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {dayLabels[day]}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={selectedDay.available}
          onCheckedChange={(checked) => onAvailabilityToggle(Boolean(checked))}
        />
        <Label>{selectedDay.available ? "Available" : "Off"}</Label>
      </div>
    </div>
  );
}

function AvailabilityDayDetails({
  selectedDay,
  onDurationPresetSelect,
  onDurationChange,
}: {
  selectedDay: OnboardingDraft["availability"][AvailabilityDay];
  onDurationPresetSelect: (preset: number) => void;
  onDurationChange: (value: number) => void;
}) {
  if (!selectedDay.available) {
    return (
      <div className="text-sm text-muted-foreground">
        This day is currently excluded from the plan.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Label>Quick picks</Label>
        <div className="flex flex-wrap gap-2">
          {availabilityPresets.slice(0, 3).map((preset) => (
            <Button
              key={preset}
              size="sm"
              variant={
                selectedDay.maxDurationMinutes === preset
                  ? "default"
                  : "outline"
              }
              onClick={() => onDurationPresetSelect(preset)}
            >
              {preset} min
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-6">
          <Label>Duration cap</Label>
          <div className="text-sm font-medium tabular-nums">
            {selectedDay.maxDurationMinutes} min
          </div>
        </div>
        <Slider
          min={15}
          max={300}
          step={5}
          value={[selectedDay.maxDurationMinutes]}
          onValueChange={(value) => {
            const nextValue = Array.isArray(value) ? value[0] : value;
            onDurationChange(nextValue ?? selectedDay.maxDurationMinutes);
          }}
        />
      </div>
    </>
  );
}
