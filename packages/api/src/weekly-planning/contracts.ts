import { z } from "zod";

import { weeklyAvailabilitySchema } from "../training-settings/contracts";
import type {
  PlanningHistoryQuality,
  PlanningHistorySnapshot,
  PlanningPerformanceSnapshot,
} from "../planning-data/contracts";

export const USER_PERCEIVED_ABILITY_LEVELS = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
} as const;

export const COREX_PERCEIVED_ABILITY_LEVELS = {
  beginner: "beginner",
  intermediate: "intermediate",
  advanced: "advanced",
} as const;

export const SUPPORTED_RACE_DISTANCES = {
  "5k": "5k",
  "10k": "10k",
  halfMarathon: "half_marathon",
  marathon: "marathon",
} as const;

export const TRAINING_PLAN_GOALS = {
  race: "race",
  runSpecificDistance: "run_specific_distance",
  startRunning: "start_running",
  getBackIntoRunning: "get_back_into_running",
  improvement5k: "5k_improvement",
  generalTraining: "general_training",
  parkrunImprovement: "parkrun_improvement",
} as const;

export const SESSION_TYPES = {
  rest: "rest",
  easyRun: "easy_run",
  longRun: "long_run",
  workout: "workout",
} as const;

export const INTERVAL_BLOCK_TYPES = {
  warmup: "warmup",
  steady: "steady",
  work: "work",
  recovery: "recovery",
  cooldown: "cooldown",
} as const;

export const DAYS_OF_WEEK = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
} as const;

const isoDateSchema = z.iso.date();

function getDayOfWeekForIsoDate(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  const orderedDays = [
    DAYS_OF_WEEK.monday,
    DAYS_OF_WEEK.tuesday,
    DAYS_OF_WEEK.wednesday,
    DAYS_OF_WEEK.thursday,
    DAYS_OF_WEEK.friday,
    DAYS_OF_WEEK.saturday,
    DAYS_OF_WEEK.sunday,
  ] as const;

  return orderedDays[(day + 6) % 7]!;
}

const userPerceivedAbilitySchema = z.enum([
  USER_PERCEIVED_ABILITY_LEVELS.beginner,
  USER_PERCEIVED_ABILITY_LEVELS.intermediate,
  USER_PERCEIVED_ABILITY_LEVELS.advanced,
]);

const corexPerceivedAbilitySchema = z.enum([
  COREX_PERCEIVED_ABILITY_LEVELS.beginner,
  COREX_PERCEIVED_ABILITY_LEVELS.intermediate,
  COREX_PERCEIVED_ABILITY_LEVELS.advanced,
]);

export const trainingPlanGoalSchema = z.enum([
  TRAINING_PLAN_GOALS.race,
  TRAINING_PLAN_GOALS.runSpecificDistance,
  TRAINING_PLAN_GOALS.startRunning,
  TRAINING_PLAN_GOALS.getBackIntoRunning,
  TRAINING_PLAN_GOALS.improvement5k,
  TRAINING_PLAN_GOALS.generalTraining,
  TRAINING_PLAN_GOALS.parkrunImprovement,
]);

export const supportedRaceDistanceSchema = z.enum([
  SUPPORTED_RACE_DISTANCES["5k"],
  SUPPORTED_RACE_DISTANCES["10k"],
  SUPPORTED_RACE_DISTANCES.halfMarathon,
  SUPPORTED_RACE_DISTANCES.marathon,
]);

export const raceBenchmarkSchema = z
  .object({
    estimatedRaceDistance: supportedRaceDistanceSchema,
    estimatedRaceTimeSeconds: z.number().int().positive(),
  })
  .strict();

const racePlannerIntentSchema = z
  .object({
    planGoal: z.literal(TRAINING_PLAN_GOALS.race),
    raceBenchmark: raceBenchmarkSchema,
  })
  .strict();

const nonRacePlannerIntentSchema = z
  .object({
    planGoal: z.enum([
      TRAINING_PLAN_GOALS.runSpecificDistance,
      TRAINING_PLAN_GOALS.startRunning,
      TRAINING_PLAN_GOALS.getBackIntoRunning,
      TRAINING_PLAN_GOALS.improvement5k,
      TRAINING_PLAN_GOALS.generalTraining,
      TRAINING_PLAN_GOALS.parkrunImprovement,
    ]),
  })
  .strict();

export const plannerIntentSchema = z.discriminatedUnion("planGoal", [
  racePlannerIntentSchema,
  nonRacePlannerIntentSchema,
]);

export const plannerGoalOptionSchema = z
  .object({
    value: trainingPlanGoalSchema,
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(240),
  })
  .strict();

export const dayOfWeekSchema = z.enum([
  DAYS_OF_WEEK.monday,
  DAYS_OF_WEEK.tuesday,
  DAYS_OF_WEEK.wednesday,
  DAYS_OF_WEEK.thursday,
  DAYS_OF_WEEK.friday,
  DAYS_OF_WEEK.saturday,
  DAYS_OF_WEEK.sunday,
]);

export const intervalTargetSchema = z
  .object({
    durationSeconds: z.number().int().positive().nullable(),
    distanceMeters: z.number().positive().nullable(),
    pace: z.string().trim().min(1).max(120).nullable(),
    heartRate: z.string().trim().min(1).max(120).nullable(),
    rpe: z.number().min(1).max(10).nullable(),
  })
  .refine(
    (value) => value.durationSeconds !== null || value.distanceMeters !== null,
    {
      message: "Interval blocks require a duration or distance target",
    },
  );

export const intervalBlockSchema = z.object({
  blockType: z.enum([
    INTERVAL_BLOCK_TYPES.warmup,
    INTERVAL_BLOCK_TYPES.steady,
    INTERVAL_BLOCK_TYPES.work,
    INTERVAL_BLOCK_TYPES.recovery,
    INTERVAL_BLOCK_TYPES.cooldown,
  ]),
  order: z.number().int().positive(),
  repetitions: z.number().int().positive(),
  title: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).nullable(),
  target: intervalTargetSchema,
});

export const plannedSessionSchema = z.object({
  sessionType: z.enum([
    SESSION_TYPES.rest,
    SESSION_TYPES.easyRun,
    SESSION_TYPES.longRun,
    SESSION_TYPES.workout,
  ]),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(500),
  coachingNotes: z.string().trim().max(1000).nullable(),
  estimatedDurationSeconds: z.number().int().nonnegative(),
  estimatedDistanceMeters: z.number().nonnegative().nullable(),
  intervalBlocks: z.array(intervalBlockSchema),
});

export const plannedDaySchema = z.object({
  date: isoDateSchema,
  session: plannedSessionSchema.nullable(),
});

export const weeklyPlanPayloadSchema = z.object({
  days: z.array(plannedDaySchema).length(7),
});

export const corexPerceivedAbilitySummarySchema = z.object({
  level: corexPerceivedAbilitySchema,
  rationale: z.string().trim().min(1).max(500),
});

export const plannerDefaultsSchema = z.object({
  planGoal: trainingPlanGoalSchema,
  userPerceivedAbility: userPerceivedAbilitySchema,
  raceBenchmark: raceBenchmarkSchema.nullable(),
  longRunDay: dayOfWeekSchema,
  startDate: isoDateSchema,
  planDurationWeeks: z.number().int().min(1).max(24),
});

const generateWeeklyDraftInputBaseSchema = z.object({
  startDate: isoDateSchema,
  longRunDay: dayOfWeekSchema,
  planDurationWeeks: z.number().int().min(1).max(24),
  userPerceivedAbility: userPerceivedAbilitySchema,
});

export const generateWeeklyDraftInputSchema = z.discriminatedUnion("planGoal", [
  generateWeeklyDraftInputBaseSchema
    .extend({
      planGoal: z.literal(TRAINING_PLAN_GOALS.race),
      raceBenchmark: raceBenchmarkSchema,
    })
    .strict(),
  generateWeeklyDraftInputBaseSchema
    .extend({
      planGoal: z.enum([
        TRAINING_PLAN_GOALS.runSpecificDistance,
        TRAINING_PLAN_GOALS.startRunning,
        TRAINING_PLAN_GOALS.getBackIntoRunning,
        TRAINING_PLAN_GOALS.improvement5k,
        TRAINING_PLAN_GOALS.generalTraining,
        TRAINING_PLAN_GOALS.parkrunImprovement,
      ]),
    })
    .strict(),
]);

const draftGenerationContextV2Schema = z.object({
  plannerIntent: plannerIntentSchema,
  currentDate: isoDateSchema,
  currentDayOfWeek: dayOfWeekSchema,
  availability: weeklyAvailabilitySchema,
  historySnapshot: z.custom<PlanningHistorySnapshot>(),
  historyQuality: z.custom<PlanningHistoryQuality>(),
  performanceSnapshot: z.custom<PlanningPerformanceSnapshot>(),
  userPerceivedAbility: userPerceivedAbilitySchema,
  corexPerceivedAbility: corexPerceivedAbilitySummarySchema,
  longRunDay: dayOfWeekSchema,
  startDate: isoDateSchema,
  startDateDayOfWeek: dayOfWeekSchema,
  endDate: isoDateSchema,
  planDurationWeeks: z.number().int().min(1).max(24),
});

const legacyDraftGenerationContextSchema = z
  .object({
    goalId: z.string().trim().min(1),
    goal: z
      .object({
        type: z.enum(["event_goal", "volume_goal"]),
      })
      .passthrough(),
    availability: weeklyAvailabilitySchema,
    historySnapshot: z.custom<PlanningHistorySnapshot>(),
    historyQuality: z.custom<PlanningHistoryQuality>(),
    performanceSnapshot: z.custom<PlanningPerformanceSnapshot>(),
    userPerceivedAbility: userPerceivedAbilitySchema,
    corexPerceivedAbility: corexPerceivedAbilitySummarySchema,
    estimatedRaceDistance: supportedRaceDistanceSchema,
    estimatedRaceTimeSeconds: z.number().int().positive(),
    longRunDay: dayOfWeekSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    planDurationWeeks: z.number().int().min(1).max(24),
  })
  .transform((legacy) => ({
    plannerIntent:
      legacy.goal.type === "event_goal"
        ? {
            planGoal: TRAINING_PLAN_GOALS.race,
            raceBenchmark: {
              estimatedRaceDistance: legacy.estimatedRaceDistance,
              estimatedRaceTimeSeconds: legacy.estimatedRaceTimeSeconds,
            },
          }
        : {
            planGoal: TRAINING_PLAN_GOALS.generalTraining,
          },
    currentDate: legacy.startDate,
    currentDayOfWeek: getDayOfWeekForIsoDate(legacy.startDate),
    availability: legacy.availability,
    historySnapshot: legacy.historySnapshot,
    historyQuality: legacy.historyQuality,
    performanceSnapshot: legacy.performanceSnapshot,
    userPerceivedAbility: legacy.userPerceivedAbility,
    corexPerceivedAbility: legacy.corexPerceivedAbility,
    longRunDay: legacy.longRunDay,
    startDate: legacy.startDate,
    startDateDayOfWeek: getDayOfWeekForIsoDate(legacy.startDate),
    endDate: legacy.endDate,
    planDurationWeeks: legacy.planDurationWeeks,
  }));

export const draftGenerationContextSchema = z.union([
  draftGenerationContextV2Schema,
  legacyDraftGenerationContextSchema,
]);

export const weeklyPlanDraftSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  goalId: z.string().min(1).nullable(),
  status: z.literal("draft"),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  generationContext: draftGenerationContextSchema,
  payload: weeklyPlanPayloadSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const generationEventCategorySchema = z.enum([
  "missing_training_settings",
  "missing_goal",
  "no_local_history",
  "draft_conflict",
  "provider_failure",
  "generation_timeout",
  "invalid_structured_output",
]);

export type SupportedRaceDistance = z.infer<typeof supportedRaceDistanceSchema>;
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export type TrainingPlanGoal = z.infer<typeof trainingPlanGoalSchema>;
export type PlannerIntent = z.infer<typeof plannerIntentSchema>;
export type PlannerGoalOption = z.infer<typeof plannerGoalOptionSchema>;
export type IntervalBlock = z.infer<typeof intervalBlockSchema>;
export type PlannedSession = z.infer<typeof plannedSessionSchema>;
export type WeeklyPlanPayload = z.infer<typeof weeklyPlanPayloadSchema>;
export type PlannerDefaults = z.infer<typeof plannerDefaultsSchema>;
export type GenerateWeeklyDraftInput = z.infer<
  typeof generateWeeklyDraftInputSchema
>;
export type DraftGenerationContext = z.infer<
  typeof draftGenerationContextSchema
>;
export type WeeklyPlanDraft = z.infer<typeof weeklyPlanDraftSchema>;
export type CorexPerceivedAbilitySummary = z.infer<
  typeof corexPerceivedAbilitySummarySchema
>;
export type GenerationFailureCategory = z.infer<
  typeof generationEventCategorySchema
>;

export type PlannerState = {
  planGoalOptions: PlannerGoalOption[];
  availability: z.infer<typeof weeklyAvailabilitySchema> | null;
  historySnapshot: PlanningHistorySnapshot;
  historyQuality: PlanningHistoryQuality;
  performanceSnapshot: PlanningPerformanceSnapshot;
  defaults: PlannerDefaults | null;
  activeDraft: WeeklyPlanDraft | null;
};
