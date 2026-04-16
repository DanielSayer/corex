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

const orderedDaysOfWeek = [
  DAYS_OF_WEEK.monday,
  DAYS_OF_WEEK.tuesday,
  DAYS_OF_WEEK.wednesday,
  DAYS_OF_WEEK.thursday,
  DAYS_OF_WEEK.friday,
  DAYS_OF_WEEK.saturday,
  DAYS_OF_WEEK.sunday,
] as const;

function getUtcDayOfWeek(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return orderedDaysOfWeek[(day + 6) % 7]!;
}

const isoDateSchema = z.iso.date();

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

export const weeklyGenerationModeSchema = z.enum([
  "initial",
  "renewal",
  "regeneration",
]);

export const planQualityItemSchema = z
  .object({
    code: z.string().trim().min(1),
    severity: z.enum(["warning", "blocking"]),
    message: z.string().trim().min(1),
    metricValue: z.number().nullable(),
    thresholdValue: z.number().nullable(),
  })
  .strict();

export const planQualityReportSchema = z
  .object({
    status: z.enum(["pass", "warning", "blocked"]),
    mode: z.enum(["enforced", "advisory"]),
    summary: z.string().trim().min(1),
    items: z.array(planQualityItemSchema),
    generatedAt: z.iso.datetime(),
  })
  .strict();

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

export const updateDraftSessionInputSchema = z
  .object({
    draftId: z.string().trim().min(1),
    date: isoDateSchema,
    session: plannedSessionSchema,
  })
  .strict();

export const moveDraftSessionInputSchema = z
  .object({
    draftId: z.string().trim().min(1),
    fromDate: isoDateSchema,
    toDate: isoDateSchema,
    mode: z.enum(["move", "swap"]),
  })
  .strict();

export const regenerateDraftInputSchema = z
  .object({
    draftId: z.string().trim().min(1),
  })
  .strict();

export const finalizeDraftInputSchema = z
  .object({
    draftId: z.string().trim().min(1),
  })
  .strict();

export const listFinalizedPlansInputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(10),
    offset: z.number().int().min(0).default(0),
  })
  .strict()
  .default({ limit: 10, offset: 0 });

const draftGenerationContextSchema = z
  .object({
    plannerIntent: plannerIntentSchema,
    generationMode: weeklyGenerationModeSchema.default("initial"),
    parentWeeklyPlanId: z.string().min(1).nullable().default(null),
    previousPlanWindow: z
      .object({
        startDate: isoDateSchema,
        endDate: isoDateSchema,
      })
      .nullable()
      .default(null),
    currentDate: isoDateSchema,
    currentDayOfWeek: dayOfWeekSchema.optional(),
    availability: weeklyAvailabilitySchema,
    historySnapshot: z.custom<PlanningHistorySnapshot>(),
    historyQuality: z.custom<PlanningHistoryQuality>(),
    performanceSnapshot: z.custom<PlanningPerformanceSnapshot>(),
    userPerceivedAbility: userPerceivedAbilitySchema,
    corexPerceivedAbility: corexPerceivedAbilitySummarySchema,
    longRunDay: dayOfWeekSchema,
    startDate: isoDateSchema,
    startDateDayOfWeek: dayOfWeekSchema.optional(),
    endDate: isoDateSchema,
    planDurationWeeks: z.number().int().min(1).max(24),
  })
  .transform((context) => ({
    ...context,
    currentDayOfWeek:
      context.currentDayOfWeek ?? getUtcDayOfWeek(context.currentDate),
    startDateDayOfWeek:
      context.startDateDayOfWeek ?? getUtcDayOfWeek(context.startDate),
  }));

export const weeklyPlanSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  goalId: z.string().min(1).nullable(),
  parentWeeklyPlanId: z.string().min(1).nullable(),
  status: z.enum(["draft", "finalized"]),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  generationContext: draftGenerationContextSchema,
  payload: weeklyPlanPayloadSchema,
  qualityReport: planQualityReportSchema.nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const weeklyPlanDraftSchema = weeklyPlanSchema.extend({
  status: z.literal("draft"),
});

export const weeklyPlanFinalizedSchema = weeklyPlanSchema.extend({
  status: z.literal("finalized"),
});

export const generationEventCategorySchema = z.enum([
  "missing_training_settings",
  "missing_goal",
  "no_local_history",
  "draft_conflict",
  "provider_failure",
  "generation_timeout",
  "invalid_structured_output",
  "quality_guardrail_failure",
]);

export type SupportedRaceDistance = z.infer<typeof supportedRaceDistanceSchema>;
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;
export type TrainingPlanGoal = z.infer<typeof trainingPlanGoalSchema>;
export type PlannerIntent = z.infer<typeof plannerIntentSchema>;
export type PlannerGoalOption = z.infer<typeof plannerGoalOptionSchema>;
export type IntervalBlock = z.infer<typeof intervalBlockSchema>;
export type PlannedSession = z.infer<typeof plannedSessionSchema>;
export type WeeklyPlanPayload = z.infer<typeof weeklyPlanPayloadSchema>;
export type PlanQualityItem = z.infer<typeof planQualityItemSchema>;
export type PlanQualityReport = z.infer<typeof planQualityReportSchema>;
export type PlannerDefaults = z.infer<typeof plannerDefaultsSchema>;
export type GenerateWeeklyDraftInput = z.infer<
  typeof generateWeeklyDraftInputSchema
>;
export type UpdateDraftSessionInput = z.infer<
  typeof updateDraftSessionInputSchema
>;
export type MoveDraftSessionInput = z.infer<typeof moveDraftSessionInputSchema>;
export type RegenerateDraftInput = z.infer<typeof regenerateDraftInputSchema>;
export type FinalizeDraftInput = z.infer<typeof finalizeDraftInputSchema>;
export type ListFinalizedPlansInput = z.input<
  typeof listFinalizedPlansInputSchema
>;
export type DraftGenerationContext = z.infer<
  typeof draftGenerationContextSchema
>;
export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>;
export type WeeklyPlanDraft = z.infer<typeof weeklyPlanDraftSchema>;
export type WeeklyPlanFinalized = z.infer<typeof weeklyPlanFinalizedSchema>;
export type WeeklyGenerationMode = z.infer<typeof weeklyGenerationModeSchema>;
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
  currentFinalizedPlan: WeeklyPlanFinalized | null;
};

export type FinalizedPlanHistory = {
  items: WeeklyPlanFinalized[];
  nextOffset: number | null;
};
