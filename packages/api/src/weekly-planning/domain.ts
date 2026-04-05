import type {
  CorexPerceivedAbilitySummary,
  DayOfWeek,
  DraftGenerationContext,
  PlannerGoalOption,
  PlannerIntent,
  IntervalBlock,
  PlannerDefaults,
  WeeklyPlanPayload,
} from "./contracts";
import {
  COREX_PERCEIVED_ABILITY_LEVELS,
  DAYS_OF_WEEK,
  SUPPORTED_RACE_DISTANCES,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
  generateWeeklyDraftInputSchema,
  weeklyPlanPayloadSchema,
} from "./contracts";
import type {
  PlanningHistoryQuality,
  PlanningHistorySnapshot,
  PlanningPerformanceSnapshot,
  PlanningPr,
} from "../planning-data/contracts";
import type { WeeklyAvailability } from "../training-settings/contracts";
import {
  InvalidStructuredOutput,
  WeeklyPlanningValidationError,
} from "./errors";

const raceDistanceMeters = {
  [SUPPORTED_RACE_DISTANCES["5k"]]: 5000,
  [SUPPORTED_RACE_DISTANCES["10k"]]: 10000,
  [SUPPORTED_RACE_DISTANCES.halfMarathon]: 21097.5,
  [SUPPORTED_RACE_DISTANCES.marathon]: 42195,
} as const;

const orderedDays: DayOfWeek[] = [
  DAYS_OF_WEEK.monday,
  DAYS_OF_WEEK.tuesday,
  DAYS_OF_WEEK.wednesday,
  DAYS_OF_WEEK.thursday,
  DAYS_OF_WEEK.friday,
  DAYS_OF_WEEK.saturday,
  DAYS_OF_WEEK.sunday,
];

export const plannerGoalOptions: PlannerGoalOption[] = [
  {
    value: TRAINING_PLAN_GOALS.race,
    label: "Race",
    description: "Booked in a race and want this plan shaped around it.",
  },
  {
    value: TRAINING_PLAN_GOALS.runSpecificDistance,
    label: "Run a specific distance",
    description:
      "Build toward covering a target distance, without race inputs.",
  },
  {
    value: TRAINING_PLAN_GOALS.startRunning,
    label: "Start running",
    description: "Begin running with conservative structure and progression.",
  },
  {
    value: TRAINING_PLAN_GOALS.getBackIntoRunning,
    label: "Get back into running",
    description: "Rebuild consistency after time away from regular running.",
  },
  {
    value: TRAINING_PLAN_GOALS.improvement5k,
    label: "5k improvement",
    description: "Improve 5k performance through balanced weekly training.",
  },
  {
    value: TRAINING_PLAN_GOALS.generalTraining,
    label: "General training",
    description:
      "Maintain or build general running fitness without a race target.",
  },
  {
    value: TRAINING_PLAN_GOALS.parkrunImprovement,
    label: "parkrun improvement",
    description: "Train for stronger weekly parkrun performances.",
  },
];

function addDays(date: string, count: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + count);
  return next.toISOString().slice(0, 10);
}

export function endDateForStartDate(startDate: string) {
  return addDays(startDate, 6);
}

export function getDayOfWeek(date: string): DayOfWeek {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return orderedDays[(day + 6) % 7]!;
}

export function deriveCorexPerceivedAbility(input: {
  historySnapshot: PlanningHistorySnapshot;
  historyQuality: PlanningHistoryQuality;
  performanceSnapshot: PlanningPerformanceSnapshot;
}): CorexPerceivedAbilitySummary {
  const totalRuns =
    input.historySnapshot.detailedRuns.length +
    input.historySnapshot.weeklyRollups.reduce(
      (sum, rollup) => sum + rollup.runCount,
      0,
    );
  const best5k = input.performanceSnapshot.allTimePrs.find(
    (pr) => pr.distanceLabel === "5k",
  );
  const best10k = input.performanceSnapshot.allTimePrs.find(
    (pr) => pr.distanceLabel === "10k",
  );
  const bestHalf = input.performanceSnapshot.allTimePrs.find(
    (pr) => pr.distanceLabel === "half marathon",
  );
  const longestDetailedRun = input.historySnapshot.detailedRuns.reduce(
    (longest, run) => Math.max(longest, run.distanceMeters ?? 0),
    0,
  );

  if (
    (best10k?.durationSeconds != null && best10k.durationSeconds <= 45 * 60) ||
    (bestHalf?.durationSeconds != null &&
      bestHalf.durationSeconds <= 100 * 60) ||
    longestDetailedRun >= 20000
  ) {
    return {
      level: COREX_PERCEIVED_ABILITY_LEVELS.advanced,
      rationale:
        "Recent history or best performances show durable training volume and strong race benchmarks.",
    };
  }

  if (
    input.historyQuality.meetsSnapshotThreshold ||
    totalRuns >= 8 ||
    (best5k?.durationSeconds != null && best5k.durationSeconds <= 30 * 60)
  ) {
    return {
      level: COREX_PERCEIVED_ABILITY_LEVELS.intermediate,
      rationale:
        "Local history shows a stable running habit or benchmark performance beyond beginner level.",
    };
  }

  return {
    level: COREX_PERCEIVED_ABILITY_LEVELS.beginner,
    rationale:
      "Available history is limited or early-stage, so the planner should bias toward conservative progression.",
  };
}

function pickClosestPr(
  prs: PlanningPr[],
  supportedDistance: keyof typeof raceDistanceMeters,
) {
  const targetMeters = raceDistanceMeters[supportedDistance];
  return prs.find((pr) => pr.distanceMeters === targetMeters) ?? null;
}

export function buildPlannerDefaults(input: {
  availability: WeeklyAvailability;
  historyQuality: PlanningHistoryQuality;
  performanceSnapshot: PlanningPerformanceSnapshot;
  startDate: string;
  derivedAbility: CorexPerceivedAbilitySummary;
}): PlannerDefaults {
  const prSource =
    pickClosestPr(input.performanceSnapshot.recentPrs, "10k") ??
    pickClosestPr(input.performanceSnapshot.allTimePrs, "10k") ??
    input.performanceSnapshot.recentPrs[0] ??
    input.performanceSnapshot.allTimePrs[0] ??
    null;

  return {
    planGoal: TRAINING_PLAN_GOALS.generalTraining,
    userPerceivedAbility:
      input.derivedAbility.level === COREX_PERCEIVED_ABILITY_LEVELS.advanced
        ? USER_PERCEIVED_ABILITY_LEVELS.advanced
        : input.derivedAbility.level ===
            COREX_PERCEIVED_ABILITY_LEVELS.intermediate
          ? USER_PERCEIVED_ABILITY_LEVELS.intermediate
          : USER_PERCEIVED_ABILITY_LEVELS.beginner,
    raceBenchmark:
      prSource?.durationSeconds != null
        ? {
            estimatedRaceDistance:
              prSource.distanceLabel === "5k"
                ? SUPPORTED_RACE_DISTANCES["5k"]
                : prSource.distanceLabel === "half marathon"
                  ? SUPPORTED_RACE_DISTANCES.halfMarathon
                  : prSource.distanceLabel === "marathon"
                    ? SUPPORTED_RACE_DISTANCES.marathon
                    : SUPPORTED_RACE_DISTANCES["10k"],
            estimatedRaceTimeSeconds: prSource.durationSeconds,
          }
        : null,
    longRunDay: chooseDefaultLongRunDay(input.availability),
    startDate: input.startDate,
    planDurationWeeks: input.historyQuality.meetsSnapshotThreshold ? 4 : 6,
  };
}

export function chooseDefaultLongRunDay(
  availability: WeeklyAvailability,
): DayOfWeek {
  const preferredDays: DayOfWeek[] = [
    DAYS_OF_WEEK.saturday,
    DAYS_OF_WEEK.sunday,
    DAYS_OF_WEEK.friday,
    DAYS_OF_WEEK.monday,
    DAYS_OF_WEEK.tuesday,
    DAYS_OF_WEEK.wednesday,
    DAYS_OF_WEEK.thursday,
  ];

  let selected = preferredDays[0]!;
  let selectedDuration = -1;

  for (const day of preferredDays) {
    const slot = availability[day];

    if (!slot.available) {
      continue;
    }

    const duration = slot.maxDurationMinutes ?? 10_000;

    if (duration > selectedDuration) {
      selected = day;
      selectedDuration = duration;
    }
  }

  return selected;
}

export function validateGenerateWeeklyDraftInput(input: unknown) {
  const result = generateWeeklyDraftInputSchema.safeParse(input);

  if (!result.success) {
    throw new WeeklyPlanningValidationError({
      message:
        result.error.issues[0]?.message ?? "Invalid weekly planning input",
    });
  }

  return result.data;
}

function validateIntervalBlocks(blocks: IntervalBlock[]) {
  let expectedOrder = 1;

  for (const block of blocks) {
    if (block.order !== expectedOrder) {
      throw new InvalidStructuredOutput({
        message: "Interval blocks must be sequentially ordered",
      });
    }

    if (block.repetitions <= 0) {
      throw new InvalidStructuredOutput({
        message: "Interval block repetitions must be positive",
      });
    }

    expectedOrder += 1;
  }
}

export function validateGeneratedPayload(input: {
  payload: unknown;
  availability: WeeklyAvailability;
  longRunDay: DayOfWeek;
  startDate: string;
}): WeeklyPlanPayload {
  const parsed = weeklyPlanPayloadSchema.safeParse(input.payload);

  if (!parsed.success) {
    throw new InvalidStructuredOutput({
      message:
        parsed.error.issues[0]?.message ??
        "Generated weekly plan did not match the schema",
    });
  }

  const payload = parsed.data;
  const expectedDates = Array.from({ length: 7 }, (_, index) =>
    addDays(input.startDate, index),
  );

  payload.days.forEach((day, index) => {
    if (day.date !== expectedDates[index]) {
      throw new InvalidStructuredOutput({
        message: "Generated days must cover 7 consecutive dates from startDate",
      });
    }

    const dayOfWeek = getDayOfWeek(day.date);
    const availability = input.availability[dayOfWeek];

    if (day.session) {
      validateIntervalBlocks(day.session.intervalBlocks);

      if (day.session.sessionType !== "rest" && !availability.available) {
        throw new InvalidStructuredOutput({
          message: `Generated ${day.session.sessionType} scheduled on ${dayOfWeek} ${day.date}, but that day is unavailable`,
        });
      }

      if (
        availability.maxDurationMinutes != null &&
        day.session.estimatedDurationSeconds >
          availability.maxDurationMinutes * 60
      ) {
        throw new InvalidStructuredOutput({
          message: "Generated session exceeds the stored max duration",
        });
      }
    }
  });

  const uniqueDates = new Set(payload.days.map((day) => day.date));

  if (uniqueDates.size !== payload.days.length) {
    throw new InvalidStructuredOutput({
      message: "Generated days must have unique dates",
    });
  }

  const longRuns = payload.days.filter(
    (day) => day.session?.sessionType === "long_run",
  );

  if (longRuns.length !== 1) {
    throw new InvalidStructuredOutput({
      message: "Generated plan must contain exactly one long run",
    });
  }

  if (getDayOfWeek(longRuns[0]!.date) !== input.longRunDay) {
    throw new InvalidStructuredOutput({
      message: "Long run must land on the selected long-run day",
    });
  }

  return payload;
}

export function createDraftGenerationContext(input: {
  plannerIntent: PlannerIntent;
  currentDate: string;
  availability: WeeklyAvailability;
  historySnapshot: PlanningHistorySnapshot;
  historyQuality: PlanningHistoryQuality;
  performanceSnapshot: PlanningPerformanceSnapshot;
  userPerceivedAbility: DraftGenerationContext["userPerceivedAbility"];
  corexPerceivedAbility: CorexPerceivedAbilitySummary;
  longRunDay: DayOfWeek;
  startDate: string;
  planDurationWeeks: number;
}): DraftGenerationContext {
  return {
    plannerIntent: input.plannerIntent,
    currentDate: input.currentDate,
    currentDayOfWeek: getDayOfWeek(input.currentDate),
    availability: input.availability,
    historySnapshot: input.historySnapshot,
    historyQuality: input.historyQuality,
    performanceSnapshot: input.performanceSnapshot,
    userPerceivedAbility: input.userPerceivedAbility,
    corexPerceivedAbility: input.corexPerceivedAbility,
    longRunDay: input.longRunDay,
    startDate: input.startDate,
    startDateDayOfWeek: getDayOfWeek(input.startDate),
    endDate: endDateForStartDate(input.startDate),
    planDurationWeeks: input.planDurationWeeks,
  };
}
