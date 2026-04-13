import { describe, expect, it } from "bun:test";

import {
  DAYS_OF_WEEK,
  SESSION_TYPES,
  SUPPORTED_RACE_DISTANCES,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
  type WeeklyPlanPayload,
} from "./contracts";
import {
  buildPlannerDefaults,
  chooseDefaultLongRunDay,
  createDraftGenerationContext,
  deriveCorexPerceivedAbility,
  endDateForStartDate,
  validateGeneratedPayload,
  validateGenerateWeeklyDraftInput,
} from "./domain";
import { InvalidStructuredOutput } from "./errors";

describe("weekly planning domain", () => {
  it("derives advanced ability from strong benchmarks", () => {
    const result = deriveCorexPerceivedAbility({
      historySnapshot: {
        generatedAt: "2026-04-01T00:00:00.000Z",
        detailedRuns: [],
        weeklyRollups: [],
      },
      historyQuality: {
        hasAnyHistory: true,
        meetsSnapshotThreshold: true,
        hasRecentSync: true,
        latestSyncWarnings: [],
        availableDateRange: { start: null, end: null },
      },
      performanceSnapshot: {
        allTimePrs: [
          {
            distanceMeters: 10000,
            distanceLabel: "10k",
            durationSeconds: 2600,
            activityId: "run-1",
            startAt: "2026-03-01T00:00:00.000Z",
            startSampleIndex: 0,
            endSampleIndex: 2600,
          },
        ],
        recentPrs: [],
        processingWarnings: [],
      },
    });

    expect(result.level).toBe("advanced");
  });

  it("defaults the long run to the largest available weekend slot", () => {
    expect(
      chooseDefaultLongRunDay({
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: false, maxDurationMinutes: null },
        wednesday: { available: true, maxDurationMinutes: 60 },
        thursday: { available: false, maxDurationMinutes: null },
        friday: { available: true, maxDurationMinutes: 70 },
        saturday: { available: true, maxDurationMinutes: 120 },
        sunday: { available: true, maxDurationMinutes: 90 },
      }),
    ).toBe(DAYS_OF_WEEK.saturday);
  });

  it("builds defaults from planner data", () => {
    const defaults = buildPlannerDefaults({
      availability: {
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: false, maxDurationMinutes: null },
        wednesday: { available: true, maxDurationMinutes: 60 },
        thursday: { available: false, maxDurationMinutes: null },
        friday: { available: true, maxDurationMinutes: 70 },
        saturday: { available: true, maxDurationMinutes: 120 },
        sunday: { available: true, maxDurationMinutes: 90 },
      },
      historyQuality: {
        hasAnyHistory: true,
        meetsSnapshotThreshold: true,
        hasRecentSync: true,
        latestSyncWarnings: [],
        availableDateRange: { start: null, end: null },
      },
      performanceSnapshot: {
        allTimePrs: [
          {
            distanceMeters: 10000,
            distanceLabel: "10k",
            durationSeconds: 3000,
            activityId: "run-1",
            startAt: "2026-03-01T00:00:00.000Z",
            startSampleIndex: 0,
            endSampleIndex: 3000,
          },
        ],
        recentPrs: [],
        processingWarnings: [],
      },
      startDate: "2026-04-06",
      derivedAbility: {
        level: "intermediate",
        rationale: "Stable running history.",
      },
    });

    expect(defaults).toMatchObject({
      planGoal: TRAINING_PLAN_GOALS.generalTraining,
      userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      raceBenchmark: {
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
      },
      longRunDay: DAYS_OF_WEEK.saturday,
      startDate: "2026-04-06",
      planDurationWeeks: 4,
    });
  });

  it("validates payload safety rules", () => {
    const payload: WeeklyPlanPayload = {
      days: [
        {
          date: "2026-04-06",
          session: {
            sessionType: SESSION_TYPES.easyRun,
            title: "Easy",
            summary: "Easy run",
            coachingNotes: null,
            estimatedDurationSeconds: 1800,
            estimatedDistanceMeters: 5000,
            intervalBlocks: [
              {
                blockType: "steady",
                order: 1,
                repetitions: 1,
                title: "Steady",
                notes: null,
                target: {
                  durationSeconds: 1800,
                  distanceMeters: null,
                  pace: null,
                  heartRate: "Z2",
                  rpe: 4,
                },
              },
            ],
          },
        },
        { date: "2026-04-07", session: null },
        { date: "2026-04-08", session: null },
        { date: "2026-04-09", session: null },
        {
          date: "2026-04-10",
          session: {
            sessionType: SESSION_TYPES.longRun,
            title: "Long run",
            summary: "Long run",
            coachingNotes: null,
            estimatedDurationSeconds: 3600,
            estimatedDistanceMeters: 16000,
            intervalBlocks: [
              {
                blockType: "steady",
                order: 1,
                repetitions: 1,
                title: "Long",
                notes: null,
                target: {
                  durationSeconds: 3600,
                  distanceMeters: null,
                  pace: null,
                  heartRate: "Z2",
                  rpe: 5,
                },
              },
            ],
          },
        },
        { date: "2026-04-11", session: null },
        { date: "2026-04-12", session: null },
      ],
    };

    expect(
      validateGeneratedPayload({
        payload,
        availability: {
          monday: { available: true, maxDurationMinutes: 60 },
          tuesday: { available: true, maxDurationMinutes: 60 },
          wednesday: { available: true, maxDurationMinutes: 60 },
          thursday: { available: true, maxDurationMinutes: 60 },
          friday: { available: true, maxDurationMinutes: 90 },
          saturday: { available: true, maxDurationMinutes: 90 },
          sunday: { available: true, maxDurationMinutes: 90 },
        },
        longRunDay: DAYS_OF_WEEK.friday,
        startDate: "2026-04-06",
      }),
    ).toEqual(payload);
  });

  it("rejects payloads that exceed availability", () => {
    const payload = {
      days: [
        {
          date: "2026-04-06",
          session: {
            sessionType: SESSION_TYPES.longRun,
            title: "Too long",
            summary: "Too long",
            coachingNotes: null,
            estimatedDurationSeconds: 7200,
            estimatedDistanceMeters: 20000,
            intervalBlocks: [
              {
                blockType: "steady",
                order: 1,
                repetitions: 1,
                title: "Long",
                notes: null,
                target: {
                  durationSeconds: 7200,
                  distanceMeters: null,
                  pace: null,
                  heartRate: "Z2",
                  rpe: 5,
                },
              },
            ],
          },
        },
        ...Array.from({ length: 6 }, (_, index) => ({
          date:
            endDateForStartDate("2026-04-06").slice(0, 10) &&
            `2026-04-${String(index + 7).padStart(2, "0")}`,
          session: null,
        })),
      ],
    };

    expect(() =>
      validateGeneratedPayload({
        payload,
        availability: {
          monday: { available: true, maxDurationMinutes: 30 },
          tuesday: { available: true, maxDurationMinutes: 30 },
          wednesday: { available: true, maxDurationMinutes: 30 },
          thursday: { available: true, maxDurationMinutes: 30 },
          friday: { available: true, maxDurationMinutes: 30 },
          saturday: { available: true, maxDurationMinutes: 30 },
          sunday: { available: true, maxDurationMinutes: 30 },
        },
        longRunDay: DAYS_OF_WEEK.monday,
        startDate: "2026-04-06",
      }),
    ).toThrow(InvalidStructuredOutput);
  });

  it("reports the exact unavailable day when a session is scheduled there", () => {
    const payload: WeeklyPlanPayload = {
      days: [
        { date: "2026-04-06", session: null },
        {
          date: "2026-04-07",
          session: {
            sessionType: SESSION_TYPES.easyRun,
            title: "Easy",
            summary: "Easy run",
            coachingNotes: null,
            estimatedDurationSeconds: 1800,
            estimatedDistanceMeters: 5000,
            intervalBlocks: [
              {
                blockType: "steady",
                order: 1,
                repetitions: 1,
                title: "Steady",
                notes: null,
                target: {
                  durationSeconds: 1800,
                  distanceMeters: null,
                  pace: null,
                  heartRate: "Z2",
                  rpe: 4,
                },
              },
            ],
          },
        },
        { date: "2026-04-08", session: null },
        { date: "2026-04-09", session: null },
        { date: "2026-04-10", session: null },
        {
          date: "2026-04-11",
          session: {
            sessionType: SESSION_TYPES.longRun,
            title: "Long run",
            summary: "Long run",
            coachingNotes: null,
            estimatedDurationSeconds: 3600,
            estimatedDistanceMeters: 16000,
            intervalBlocks: [
              {
                blockType: "steady",
                order: 1,
                repetitions: 1,
                title: "Long",
                notes: null,
                target: {
                  durationSeconds: 3600,
                  distanceMeters: null,
                  pace: null,
                  heartRate: "Z2",
                  rpe: 5,
                },
              },
            ],
          },
        },
        { date: "2026-04-12", session: null },
      ],
    };

    expect(() =>
      validateGeneratedPayload({
        payload,
        availability: {
          monday: { available: true, maxDurationMinutes: 60 },
          tuesday: { available: false, maxDurationMinutes: null },
          wednesday: { available: true, maxDurationMinutes: 60 },
          thursday: { available: true, maxDurationMinutes: 60 },
          friday: { available: true, maxDurationMinutes: 90 },
          saturday: { available: true, maxDurationMinutes: 90 },
          sunday: { available: true, maxDurationMinutes: 90 },
        },
        longRunDay: DAYS_OF_WEEK.saturday,
        startDate: "2026-04-06",
      }),
    ).toThrow(
      "Generated easy_run scheduled on tuesday 2026-04-07, but that day is unavailable",
    );
  });

  it("accepts race plans with required benchmark inputs", () => {
    const input = validateGenerateWeeklyDraftInput({
      planGoal: TRAINING_PLAN_GOALS.race,
      startDate: "2026-04-06",
      longRunDay: DAYS_OF_WEEK.saturday,
      planDurationWeeks: 4,
      userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.beginner,
      raceBenchmark: {
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["5k"],
        estimatedRaceTimeSeconds: 1800,
      },
    });

    const context = createDraftGenerationContext({
      plannerIntent: {
        planGoal: input.planGoal,
        raceBenchmark:
          input.planGoal === TRAINING_PLAN_GOALS.race
            ? input.raceBenchmark
            : {
                estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["5k"],
                estimatedRaceTimeSeconds: 1800,
              },
      },
      generationMode: "initial",
      parentWeeklyPlanId: null,
      previousPlanWindow: null,
      currentDate: "2026-04-01",
      availability: {
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: true, maxDurationMinutes: 45 },
        wednesday: { available: true, maxDurationMinutes: 45 },
        thursday: { available: true, maxDurationMinutes: 45 },
        friday: { available: true, maxDurationMinutes: 45 },
        saturday: { available: true, maxDurationMinutes: 90 },
        sunday: { available: true, maxDurationMinutes: 90 },
      },
      historySnapshot: {
        generatedAt: "2026-04-01T00:00:00.000Z",
        detailedRuns: [],
        weeklyRollups: [],
      },
      historyQuality: {
        hasAnyHistory: true,
        meetsSnapshotThreshold: false,
        hasRecentSync: true,
        latestSyncWarnings: [],
        availableDateRange: { start: null, end: null },
      },
      performanceSnapshot: {
        allTimePrs: [],
        recentPrs: [],
        processingWarnings: [],
      },
      userPerceivedAbility: input.userPerceivedAbility,
      corexPerceivedAbility: {
        level: "beginner",
        rationale: "Limited history",
      },
      longRunDay: input.longRunDay,
      startDate: input.startDate,
      planDurationWeeks: input.planDurationWeeks,
    });

    expect(context.endDate).toBe("2026-04-12");
    expect(context.currentDate).toBe("2026-04-01");
    expect(context.currentDayOfWeek).toBe(DAYS_OF_WEEK.wednesday);
    expect(context.startDateDayOfWeek).toBe(DAYS_OF_WEEK.monday);
    expect(context.plannerIntent).toEqual({
      planGoal: TRAINING_PLAN_GOALS.race,
      raceBenchmark: {
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["5k"],
        estimatedRaceTimeSeconds: 1800,
      },
    });
  });

  it("accepts non-race plan goals without benchmark inputs", () => {
    const input = validateGenerateWeeklyDraftInput({
      planGoal: TRAINING_PLAN_GOALS.generalTraining,
      startDate: "2026-04-06",
      longRunDay: DAYS_OF_WEEK.saturday,
      planDurationWeeks: 4,
      userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.beginner,
    });

    expect(input.planGoal).toBe(TRAINING_PLAN_GOALS.generalTraining);
  });

  it("rejects non-race goals when race benchmark inputs are provided", () => {
    expect(() =>
      validateGenerateWeeklyDraftInput({
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.beginner,
        raceBenchmark: {
          estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["5k"],
          estimatedRaceTimeSeconds: 1800,
        },
      }),
    ).toThrow('Unrecognized key: "raceBenchmark"');
  });

  it("rejects unsupported planner goals", () => {
    expect(() =>
      validateGenerateWeeklyDraftInput({
        planGoal: "functional_fitness",
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.beginner,
      }),
    ).toThrow("Invalid input");
  });
});
