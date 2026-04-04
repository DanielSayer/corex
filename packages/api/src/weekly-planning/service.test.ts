import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import {
  DAYS_OF_WEEK,
  SUPPORTED_RACE_DISTANCES,
  USER_PERCEIVED_ABILITY_LEVELS,
  type PlannerState,
  type WeeklyPlanDraft,
} from "./contracts";
import { DraftConflict, InvalidStructuredOutput } from "./errors";
import type { PlannerModelPort } from "./model";
import type { WeeklyPlanningRepository } from "./repository";
import { createWeeklyPlanningService } from "./service";

function createRepository(
  overrides: Partial<WeeklyPlanningRepository> = {},
): WeeklyPlanningRepository {
  return {
    getActiveDraft: () => Effect.succeed(null),
    createDraft: (input) =>
      Effect.succeed({
        id: input.id,
        userId: input.userId,
        goalId: input.goalId,
        status: "draft",
        startDate: input.startDate,
        endDate: input.endDate,
        generationContext: input.generationContext,
        payload: input.payload,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      } satisfies WeeklyPlanDraft),
    recordGenerationEvent: (input) =>
      Effect.succeed({
        ...input,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ...overrides,
  };
}

function createPlannerState(): PlannerState {
  return {
    goalCandidates: [
      {
        id: "goal-1",
        status: "active",
        goal: {
          type: "volume_goal",
          metric: "distance",
          period: "week",
          targetValue: 40,
          unit: "km",
        },
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ],
    availability: {
      monday: { available: true, maxDurationMinutes: 45 },
      tuesday: { available: true, maxDurationMinutes: 45 },
      wednesday: { available: true, maxDurationMinutes: 60 },
      thursday: { available: true, maxDurationMinutes: 45 },
      friday: { available: true, maxDurationMinutes: 90 },
      saturday: { available: true, maxDurationMinutes: 120 },
      sunday: { available: true, maxDurationMinutes: 90 },
    },
    historySnapshot: {
      generatedAt: "2026-04-01T00:00:00.000Z",
      detailedRuns: [
        {
          startAt: "2026-03-30T00:00:00.000Z",
          distanceMeters: 10000,
          elapsedTimeSeconds: 3200,
          movingTimeSeconds: 3100,
          elevationGainMeters: 100,
          heartRateZoneTimes: {
            z1Seconds: 0,
            z2Seconds: 2000,
            z3Seconds: 1000,
            z4Seconds: 100,
            z5Seconds: 0,
          },
          averageHeartrate: 150,
          averageSpeedMetersPerSecond: 3.2,
          normalizedActivityType: "Run",
        },
      ],
      weeklyRollups: [],
    },
    historyQuality: {
      hasAnyHistory: true,
      meetsSnapshotThreshold: true,
      hasRecentSync: true,
      latestSyncWarnings: [],
      availableDateRange: {
        start: "2026-03-01T00:00:00.000Z",
        end: "2026-03-30T00:00:00.000Z",
      },
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
    defaults: null,
    activeDraft: null,
  };
}

function createModel(
  overrides: Partial<PlannerModelPort> = {},
): PlannerModelPort {
  return {
    provider: "test",
    model: "fake-model",
    generateWeeklyPlan: () =>
      Effect.succeed({
        days: [
          {
            date: "2026-04-06",
            session: {
              sessionType: "easy_run",
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
          { date: "2026-04-10", session: null },
          {
            date: "2026-04-11",
            session: {
              sessionType: "long_run",
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
      }),
    ...overrides,
  };
}

function createService(
  options: {
    state?: PlannerState;
    repo?: WeeklyPlanningRepository;
    model?: PlannerModelPort;
  } = {},
) {
  const state = options.state ?? createPlannerState();

  return createWeeklyPlanningService({
    goalsApi: {
      getForUser: () => Effect.succeed(state.goalCandidates),
    },
    trainingSettingsService: {
      getForUser: () =>
        Effect.succeed({
          status: state.availability ? "complete" : "not_started",
          availability: state.availability,
          intervalsCredential: {
            hasKey: true,
            username: "runner@example.com",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        }),
    },
    planningDataService: {
      getPlanningHistorySnapshot: () => Effect.succeed(state.historySnapshot),
      getHistoryQuality: () => Effect.succeed(state.historyQuality),
      getPlanningPerformanceSnapshot: () =>
        Effect.succeed(state.performanceSnapshot),
    },
    repo: options.repo ?? createRepository(),
    model: options.model ?? createModel(),
    clock: {
      now: () => new Date("2026-04-01T00:00:00.000Z"),
    },
    idGenerator: (() => {
      let index = 0;
      return () => `id-${++index}`;
    })(),
  });
}

describe("weekly planning service", () => {
  it("builds planner state with defaults and no draft", async () => {
    const service = createService();

    const state = await Effect.runPromise(service.getState("user-1"));

    expect(state.goalCandidates).toHaveLength(1);
    expect(state.defaults).toMatchObject({
      estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
      longRunDay: DAYS_OF_WEEK.saturday,
    });
    expect(state.activeDraft).toBeNull();
  });

  it("persists a generated draft when the model returns a valid plan", async () => {
    const service = createService();

    const draft = await Effect.runPromise(
      service.generateDraft("user-1", {
        goalId: "goal-1",
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
      }),
    );

    expect(draft.status).toBe("draft");
    expect(draft.startDate).toBe("2026-04-06");
    expect(draft.endDate).toBe("2026-04-12");
  });

  it("rejects generation when an active draft already exists", async () => {
    const existingDraft: WeeklyPlanDraft = {
      id: "draft-1",
      userId: "user-1",
      goalId: "goal-1",
      status: "draft",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      generationContext: {
        goalId: "goal-1",
        goal: {
          type: "volume_goal",
          metric: "distance",
          period: "week",
          targetValue: 40,
          unit: "km",
        },
        availability: createPlannerState().availability!,
        historySnapshot: createPlannerState().historySnapshot,
        historyQuality: createPlannerState().historyQuality,
        performanceSnapshot: createPlannerState().performanceSnapshot,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        corexPerceivedAbility: {
          level: "intermediate",
          rationale: "Stable running history.",
        },
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
        longRunDay: DAYS_OF_WEEK.saturday,
        startDate: "2026-04-06",
        endDate: "2026-04-12",
        planDurationWeeks: 4,
      },
      payload: {
        days: Array.from({ length: 7 }, (_, index) => ({
          date: `2026-04-${String(index + 6).padStart(2, "0")}`,
          session: null,
        })),
      },
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const service = createService({
      repo: createRepository({
        getActiveDraft: () => Effect.succeed(existingDraft),
      }),
    });

    const exit = await Effect.runPromiseExit(
      service.generateDraft("user-1", {
        goalId: "goal-1",
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(DraftConflict);
      }
    }
  });

  it("rejects invalid structured output from the model", async () => {
    const service = createService({
      model: createModel({
        generateWeeklyPlan: () =>
          Effect.succeed({
            days: Array.from({ length: 7 }, (_, index) => ({
              date: `2026-04-${String(index + 6).padStart(2, "0")}`,
              session: null,
            })),
          }),
      }),
    });

    const exit = await Effect.runPromiseExit(
      service.generateDraft("user-1", {
        goalId: "goal-1",
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(InvalidStructuredOutput);
      }
    }
  });
});
