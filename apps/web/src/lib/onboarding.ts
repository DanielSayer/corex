import {
  trainingGoalSchema,
  trainingSettingsInputSchema,
  weeklyAvailabilitySchema,
  type TrainingGoal,
  type WeeklyAvailability,
} from "@corex/api/training-settings/contracts";

export const onboardingSteps = [
  "goal",
  "availability",
  "credentials",
  "sync",
] as const;

export type OnboardingStep = (typeof onboardingSteps)[number];

export const availabilityDays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type AvailabilityDay = (typeof availabilityDays)[number];

export const availabilityPresets = [30, 45, 60, 90] as const;

export type EventGoalDraft = {
  type: "event_goal";
  targetDistanceValue: string;
  targetDistanceUnit: "km" | "mi";
  targetDate: string;
  eventName: string;
  targetTimeHours: string;
  targetTimeMinutes: string;
  targetTimeSeconds: string;
  notes: string;
};

export type VolumeGoalDraft = {
  type: "volume_goal";
  metric: "distance" | "time";
  period: "week" | "month";
  targetValue: string;
  unit: "km" | "mi" | "minutes";
  notes: string;
};

export type GoalDraft = EventGoalDraft | VolumeGoalDraft;

export type AvailabilityDraftDay = {
  available: boolean;
  maxDurationMinutes: number;
};

export type AvailabilityDraft = Record<AvailabilityDay, AvailabilityDraftDay>;

export type OnboardingDraft = {
  goal: GoalDraft;
  availability: AvailabilityDraft;
  intervalsUsername: string;
  intervalsApiKey: string;
};

export type StepErrors = Record<string, string>;

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function trimOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatOptionalTimeUnit(value: number) {
  return value > 0 ? String(value) : "";
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function createDefaultOnboardingDraft(
  now = new Date(),
): OnboardingDraft {
  return {
    goal: {
      type: "event_goal",
      targetDistanceValue: "10",
      targetDistanceUnit: "km",
      targetDate: formatIsoDate(addDays(now, 84)),
      eventName: "",
      targetTimeHours: "",
      targetTimeMinutes: "",
      targetTimeSeconds: "",
      notes: "",
    },
    availability: {
      monday: { available: true, maxDurationMinutes: 45 },
      tuesday: { available: true, maxDurationMinutes: 45 },
      wednesday: { available: true, maxDurationMinutes: 45 },
      thursday: { available: true, maxDurationMinutes: 45 },
      friday: { available: true, maxDurationMinutes: 45 },
      saturday: { available: true, maxDurationMinutes: 60 },
      sunday: { available: false, maxDurationMinutes: 45 },
    },
    intervalsUsername: "",
    intervalsApiKey: "",
  };
}

export function serializeTargetTime(draft: EventGoalDraft) {
  const values = [
    draft.targetTimeHours,
    draft.targetTimeMinutes,
    draft.targetTimeSeconds,
  ].map((value) => value.trim());

  if (values.every((value) => value.length === 0)) {
    return { value: undefined } as const;
  }

  if (values.some((value) => !/^\d+$/.test(value))) {
    return {
      error: "Target time must use whole numbers only",
    } as const;
  }

  const hours = Number(values[0] || "0");
  const minutes = Number(values[1] || "0");
  const seconds = Number(values[2] || "0");

  if (minutes > 59 || seconds > 59) {
    return {
      error: "Minutes and seconds must be less than 60",
    } as const;
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  if (totalSeconds <= 0) {
    return {
      error: "Target time must be greater than zero",
    } as const;
  }

  return { value: totalSeconds } as const;
}

function serializeGoalDraftInternal(draft: GoalDraft): {
  value?: TrainingGoal;
  errors?: StepErrors;
} {
  if (draft.type === "event_goal") {
    const targetTime = serializeTargetTime(draft);

    if (targetTime.error) {
      return {
        errors: {
          "goal.targetTime": targetTime.error,
        },
      };
    }

    const result = trainingGoalSchema.safeParse({
      type: "event_goal",
      targetDistance: {
        value: parsePositiveNumber(draft.targetDistanceValue),
        unit: draft.targetDistanceUnit,
      },
      targetDate: draft.targetDate,
      eventName: trimOptionalString(draft.eventName),
      targetTimeSeconds: targetTime.value,
      notes: trimOptionalString(draft.notes),
    });

    if (!result.success) {
      const issue = result.error.issues[0];

      if (!issue) {
        return { errors: { "goal.form": "Goal details are invalid" } };
      }

      const path = issue.path.join(".");
      const key =
        path === "targetDistance.value"
          ? "goal.targetDistanceValue"
          : path === "targetDate"
            ? "goal.targetDate"
            : path === "targetDistance.unit"
              ? "goal.targetDistanceUnit"
              : "goal.form";

      return { errors: { [key]: issue.message } };
    }

    return { value: result.data };
  }

  const result = trainingGoalSchema.safeParse({
    type: "volume_goal",
    metric: draft.metric,
    period: draft.period,
    targetValue: parsePositiveNumber(draft.targetValue),
    unit: draft.metric === "time" ? "minutes" : draft.unit,
    notes: trimOptionalString(draft.notes),
  });

  if (!result.success) {
    const issue = result.error.issues[0];

    if (!issue) {
      return { errors: { "goal.form": "Goal details are invalid" } };
    }

    const path = issue.path.join(".");
    const key =
      path === "targetValue"
        ? "goal.targetValue"
        : path === "unit"
          ? "goal.unit"
          : "goal.form";

    return { errors: { [key]: issue.message } };
  }

  return { value: result.data };
}

function serializeAvailabilityDraftInternal(draft: AvailabilityDraft): {
  value?: WeeklyAvailability;
  errors?: StepErrors;
} {
  const result = weeklyAvailabilitySchema.safeParse(
    Object.fromEntries(
      availabilityDays.map((day) => [
        day,
        draft[day].available
          ? {
              available: true,
              maxDurationMinutes: draft[day].maxDurationMinutes,
            }
          : {
              available: false,
              maxDurationMinutes: null,
            },
      ]),
    ),
  );

  if (!result.success) {
    const issue = result.error.issues[0];

    if (!issue) {
      return {
        errors: {
          "availability.form": "Availability details are invalid",
        },
      };
    }

    const path = issue.path.join(".");
    const key =
      typeof issue.path[0] === "string"
        ? `availability.${path}`
        : "availability.form";

    return { errors: { [key]: issue.message } };
  }

  return { value: result.data };
}

export function validateStep(draft: OnboardingDraft, step: OnboardingStep) {
  if (step === "goal") {
    return serializeGoalDraftInternal(draft.goal).errors ?? {};
  }

  if (step === "availability") {
    return serializeAvailabilityDraftInternal(draft.availability).errors ?? {};
  }

  if (step === "credentials") {
    const errors: StepErrors = {};

    if (draft.intervalsUsername.trim().length === 0) {
      errors.intervalsUsername = "Intervals username is required";
    }

    if (draft.intervalsApiKey.trim().length === 0) {
      errors.intervalsApiKey = "Intervals API key is required";
    }

    return errors;
  }

  return {};
}

export function buildTrainingGoalInput(draft: GoalDraft): {
  value?: TrainingGoal;
  errors?: StepErrors;
} {
  return serializeGoalDraftInternal(draft);
}

export function buildTrainingSettingsInput(draft: OnboardingDraft): {
  value?: {
    availability: WeeklyAvailability;
    intervalsUsername: string;
    intervalsApiKey: string;
  };
  errors?: StepErrors;
} {
  const availabilityResult = serializeAvailabilityDraftInternal(
    draft.availability,
  );

  if (!availabilityResult.value) {
    return { errors: availabilityResult.errors };
  }

  const parsed = trainingSettingsInputSchema.safeParse({
    availability: availabilityResult.value,
    intervalsUsername: draft.intervalsUsername.trim(),
    intervalsApiKey: draft.intervalsApiKey.trim(),
  });

  if (!parsed.success) {
    const errors = validateStep(draft, "credentials");
    return {
      errors:
        Object.keys(errors).length > 0
          ? errors
          : {
              credentials:
                parsed.error.issues[0]?.message ?? "Invalid settings",
            },
    };
  }

  return { value: parsed.data };
}

export function createGoalDraftFromTrainingGoal(goal: TrainingGoal): GoalDraft {
  if (goal.type === "event_goal") {
    const targetTimeSeconds = goal.targetTimeSeconds ?? 0;
    const hours = Math.floor(targetTimeSeconds / 3600);
    const minutes = Math.floor((targetTimeSeconds % 3600) / 60);
    const seconds = targetTimeSeconds % 60;

    return {
      type: "event_goal",
      targetDistanceValue: String(goal.targetDistance.value),
      targetDistanceUnit: goal.targetDistance.unit,
      targetDate: goal.targetDate,
      eventName: goal.eventName ?? "",
      targetTimeHours: formatOptionalTimeUnit(hours),
      targetTimeMinutes: formatOptionalTimeUnit(minutes),
      targetTimeSeconds: formatOptionalTimeUnit(seconds),
      notes: goal.notes ?? "",
    };
  }

  return {
    type: "volume_goal",
    metric: goal.metric,
    period: goal.period,
    targetValue: String(goal.targetValue),
    unit: goal.unit,
    notes: goal.notes ?? "",
  };
}
