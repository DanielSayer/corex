import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import {
  DAYS_OF_WEEK,
  SUPPORTED_RACE_DISTANCES,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
  type PlannerState,
  type WeeklyPlanDraft,
  type WeeklyPlanPayload,
} from "./contracts";
import { plannerGoalOptions } from "./domain";
import {
  DraftConflict,
  InvalidStructuredOutput,
  MissingPriorPlan,
  PlanQualityGuardrailFailure,
} from "./errors";
import type { PlannerModelPort } from "./model";
import type { WeeklyPlanningRepository } from "./repository";
import { createWeeklyPlanningService } from "./service";

function createRepository(
  overrides: Partial<WeeklyPlanningRepository> = {},
): WeeklyPlanningRepository {
  return {
    getActiveDraft: () => Effect.succeed(null),
    getLatestPlan: () => Effect.succeed(null),
    getDraftForStartDate: () => Effect.succeed(null),
    getDraftById: () => Effect.succeed(null),
    getPlanById: () => Effect.succeed(null),
    getPlanForDate: () => Effect.succeed(null),
    getFinalizedPlanForDate: () => Effect.succeed(null),
    findOverlappingFinalizedPlan: () => Effect.succeed(null),
    listFinalizedPlans: () => Effect.succeed([]),
    listGenerationEvents: () => Effect.succeed([]),
    listPlansInRange: () => Effect.succeed([]),
    createDraft: (input) =>
      Effect.succeed({
        id: input.id,
        userId: input.userId,
        goalId: input.goalId,
        parentWeeklyPlanId: input.parentWeeklyPlanId,
        status: "draft",
        startDate: input.startDate,
        endDate: input.endDate,
        generationContext: input.generationContext,
        payload: input.payload,
        qualityReport: input.qualityReport ?? null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      } satisfies WeeklyPlanDraft),
    updateDraftPayload: () => Effect.succeed(null),
    replaceDraftGeneration: () => Effect.succeed(null),
    finalizeDraft: () => Effect.succeed(null),
    recordGenerationEvent: (input) =>
      Effect.succeed({
        ...input,
        qualityReport: input.qualityReport ?? null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ...overrides,
  };
}

function createPlannerState(): PlannerState {
  return {
    planGoalOptions: plannerGoalOptions,
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
      weeklyRollups: [
        {
          weekStart: "2026-03-16",
          weekEnd: "2026-03-22",
          runCount: 3,
          totalDistanceMeters: 30000,
          totalDurationSeconds: 10800,
          longestRunDistanceMeters: 12000,
          totalElevationGainMeters: 100,
          heartRateZoneTimes: {
            z1Seconds: 0,
            z2Seconds: 9000,
            z3Seconds: 1800,
            z4Seconds: 0,
            z5Seconds: 0,
          },
        },
        {
          weekStart: "2026-03-23",
          weekEnd: "2026-03-29",
          runCount: 3,
          totalDistanceMeters: 32000,
          totalDurationSeconds: 11400,
          longestRunDistanceMeters: 13000,
          totalElevationGainMeters: 120,
          heartRateZoneTimes: {
            z1Seconds: 0,
            z2Seconds: 9600,
            z3Seconds: 1800,
            z4Seconds: 0,
            z5Seconds: 0,
          },
        },
      ],
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
    currentFinalizedPlan: null,
  };
}

function createModel(
  overrides: Partial<PlannerModelPort> = {},
): PlannerModelPort {
  return {
    provider: "test",
    model: "fake-model",
    generateWeeklyPlan: (context) =>
      Effect.succeed({
        days: Array.from({ length: 7 }, (_, index) => {
          const date = new Date(`${context.startDate}T00:00:00.000Z`);
          date.setUTCDate(date.getUTCDate() + index);
          const isoDate = date.toISOString().slice(0, 10);

          if (index === 0) {
            return {
              date: isoDate,
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
            };
          }

          if (index === 2) {
            return {
              date: isoDate,
              session: {
                sessionType: "easy_run",
                title: "Easy aerobic",
                summary: "Easy aerobic run",
                coachingNotes: null,
                estimatedDurationSeconds: 2400,
                estimatedDistanceMeters: 7000,
                intervalBlocks: [
                  {
                    blockType: "steady",
                    order: 1,
                    repetitions: 1,
                    title: "Steady",
                    notes: null,
                    target: {
                      durationSeconds: 2400,
                      distanceMeters: null,
                      pace: null,
                      heartRate: "Z2",
                      rpe: 4,
                    },
                  },
                ],
              },
            };
          }

          if (index === 5) {
            return {
              date: isoDate,
              session: {
                sessionType: "long_run",
                title: "Long run",
                summary: "Long run",
                coachingNotes: null,
                estimatedDurationSeconds: 2800,
                estimatedDistanceMeters: 8000,
                intervalBlocks: [
                  {
                    blockType: "steady",
                    order: 1,
                    repetitions: 1,
                    title: "Long",
                    notes: null,
                    target: {
                      durationSeconds: 2800,
                      distanceMeters: null,
                      pace: null,
                      heartRate: "Z2",
                      rpe: 5,
                    },
                  },
                ],
              },
            };
          }

          return {
            date: isoDate,
            session: null,
          };
        }),
      }),
    ...overrides,
  };
}

function createExcessivePayload(startDate: string): WeeklyPlanPayload {
  return {
    days: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${startDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + index);
      const isoDate = date.toISOString().slice(0, 10);

      if (index === 5) {
        return {
          date: isoDate,
          session: {
            sessionType: "long_run",
            title: "Excessive long run",
            summary: "Too much long-run load",
            coachingNotes: null,
            estimatedDurationSeconds: 5400,
            estimatedDistanceMeters: 25000,
            intervalBlocks: [
              {
                blockType: "steady",
                order: 1,
                repetitions: 1,
                title: "Long",
                notes: null,
                target: {
                  durationSeconds: 5400,
                  distanceMeters: null,
                  pace: null,
                  heartRate: "Z2",
                  rpe: 5,
                },
              },
            ],
          },
        };
      }

      if (index === 0 || index === 2 || index === 4) {
        return {
          date: isoDate,
          session: {
            sessionType: "easy_run",
            title: "Big easy run",
            summary: "Too much weekly load",
            coachingNotes: null,
            estimatedDurationSeconds: index === 0 ? 2400 : 3000,
            estimatedDistanceMeters: 15000,
            intervalBlocks: [
              {
                blockType: "steady",
                order: 1,
                repetitions: 1,
                title: "Steady",
                notes: null,
                target: {
                  durationSeconds: index === 0 ? 2400 : 3000,
                  distanceMeters: null,
                  pace: null,
                  heartRate: "Z2",
                  rpe: 4,
                },
              },
            ],
          },
        };
      }

      return {
        date: isoDate,
        session: null,
      };
    }),
  };
}

function createExcessiveModel(): PlannerModelPort {
  return createModel({
    generateWeeklyPlan: (context) =>
      Effect.succeed(createExcessivePayload(context.startDate)),
  });
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
    trainingSettingsService: {
      getForUser: () =>
        Effect.succeed({
          status: state.availability ? "complete" : "not_started",
          availability: state.availability,
          preferences: {
            timezone: "Australia/Brisbane",
          },
          intervalsCredential: {
            hasKey: true,
            username: "runner@example.com",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
        }),
      getTimezoneForUser: () => Effect.succeed("Australia/Brisbane"),
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

    expect(state.planGoalOptions).toHaveLength(7);
    expect(state.defaults).toMatchObject({
      planGoal: TRAINING_PLAN_GOALS.generalTraining,
      raceBenchmark: {
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
      },
      longRunDay: DAYS_OF_WEEK.saturday,
    });
    expect(state.activeDraft).toBeNull();
  });

  it("persists a generated draft when the model returns a valid plan", async () => {
    const service = createService();

    const draft = await Effect.runPromise(
      service.generateDraft("user-1", {
        planGoal: TRAINING_PLAN_GOALS.race,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        raceBenchmark: {
          estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
          estimatedRaceTimeSeconds: 3000,
        },
      }),
    );

    expect(draft.status).toBe("draft");
    expect(draft.goalId).toBeNull();
    expect(draft.startDate).toBe("2026-04-06");
    expect(draft.endDate).toBe("2026-04-12");
    expect(draft.generationContext.currentDate).toBe("2026-04-01");
    expect(draft.generationContext.currentDayOfWeek).toBe(
      DAYS_OF_WEEK.wednesday,
    );
    expect(draft.generationContext.startDateDayOfWeek).toBe(
      DAYS_OF_WEEK.monday,
    );
  });

  it("rejects generation when an active draft already exists", async () => {
    const existingDraft: WeeklyPlanDraft = {
      id: "draft-1",
      userId: "user-1",
      goalId: null,
      parentWeeklyPlanId: null,
      status: "draft",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      generationContext: {
        plannerIntent: {
          planGoal: TRAINING_PLAN_GOALS.generalTraining,
        },
        generationMode: "initial",
        parentWeeklyPlanId: null,
        previousPlanWindow: null,
        currentDate: "2026-04-01",
        currentDayOfWeek: DAYS_OF_WEEK.wednesday,
        availability: createPlannerState().availability!,
        historySnapshot: createPlannerState().historySnapshot,
        historyQuality: createPlannerState().historyQuality,
        performanceSnapshot: createPlannerState().performanceSnapshot,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        corexPerceivedAbility: {
          level: "intermediate",
          rationale: "Stable running history.",
        },
        longRunDay: DAYS_OF_WEEK.saturday,
        startDate: "2026-04-06",
        startDateDayOfWeek: DAYS_OF_WEEK.monday,
        endDate: "2026-04-12",
        planDurationWeeks: 4,
      },
      payload: {
        days: Array.from({ length: 7 }, (_, index) => ({
          date: `2026-04-${String(index + 6).padStart(2, "0")}`,
          session: null,
        })),
      },
      qualityReport: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const service = createService({
      repo: createRepository({
        getDraftForStartDate: () => Effect.succeed(existingDraft),
      }),
    });

    const exit = await Effect.runPromiseExit(
      service.generateDraft("user-1", {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
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

  it("generates the next chronological week from the latest stored plan", async () => {
    const latestDraft: WeeklyPlanDraft = {
      id: "draft-1",
      userId: "user-1",
      goalId: null,
      parentWeeklyPlanId: null,
      status: "draft",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      generationContext: {
        plannerIntent: {
          planGoal: TRAINING_PLAN_GOALS.generalTraining,
        },
        generationMode: "initial",
        parentWeeklyPlanId: null,
        previousPlanWindow: null,
        currentDate: "2026-04-01",
        currentDayOfWeek: DAYS_OF_WEEK.wednesday,
        availability: createPlannerState().availability!,
        historySnapshot: createPlannerState().historySnapshot,
        historyQuality: createPlannerState().historyQuality,
        performanceSnapshot: createPlannerState().performanceSnapshot,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        corexPerceivedAbility: {
          level: "intermediate",
          rationale: "Stable running history.",
        },
        longRunDay: DAYS_OF_WEEK.saturday,
        startDate: "2026-04-06",
        startDateDayOfWeek: DAYS_OF_WEEK.monday,
        endDate: "2026-04-12",
        planDurationWeeks: 4,
      },
      payload: {
        days: Array.from({ length: 7 }, (_, index) => ({
          date: `2026-04-${String(index + 6).padStart(2, "0")}`,
          session: null,
        })),
      },
      qualityReport: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };

    const service = createService({
      repo: createRepository({
        getLatestPlan: () => Effect.succeed(latestDraft),
      }),
    });

    const draft = await Effect.runPromise(service.generateNextWeek("user-1"));

    expect(draft.parentWeeklyPlanId).toBe("draft-1");
    expect(draft.startDate).toBe("2026-04-13");
    expect(draft.endDate).toBe("2026-04-19");
    expect(draft.generationContext.generationMode).toBe("renewal");
    expect(draft.generationContext.parentWeeklyPlanId).toBe("draft-1");
    expect(draft.generationContext.previousPlanWindow).toEqual({
      startDate: "2026-04-06",
      endDate: "2026-04-12",
    });
  });

  it("rejects next-week generation when there is no previous plan", async () => {
    const service = createService();

    const exit = await Effect.runPromiseExit(
      service.generateNextWeek("user-1"),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(MissingPriorPlan);
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
        planGoal: TRAINING_PLAN_GOALS.race,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        raceBenchmark: {
          estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
          estimatedRaceTimeSeconds: 3000,
        },
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

  it("records blocking quality failures without creating a draft", async () => {
    const events: Array<
      Parameters<WeeklyPlanningRepository["recordGenerationEvent"]>[0]
    > = [];
    let createDraftCalled = false;
    const service = createService({
      model: createExcessiveModel(),
      repo: createRepository({
        createDraft: () => {
          createDraftCalled = true;
          return Effect.die(
            new Error("createDraft should not run for blocked quality reports"),
          );
        },
        recordGenerationEvent: (input) => {
          events.push(input);
          return Effect.succeed({
            ...input,
            qualityReport: input.qualityReport ?? null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          });
        },
      }),
    });

    const exit = await Effect.runPromiseExit(
      service.generateDraft("user-1", {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(PlanQualityGuardrailFailure);
      }
    }

    expect(createDraftCalled).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: "failure",
      failureCategory: "quality_guardrail_failure",
      weeklyPlanId: null,
    });
    expect(events[0]?.qualityReport).toMatchObject({
      status: "blocked",
      mode: "enforced",
    });
  });

  it("persists warning quality reports on successful generation events", async () => {
    const events: Array<
      Parameters<WeeklyPlanningRepository["recordGenerationEvent"]>[0]
    > = [];
    const service = createService({
      repo: createRepository({
        recordGenerationEvent: (input) => {
          events.push(input);
          return Effect.succeed({
            ...input,
            qualityReport: input.qualityReport ?? null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          });
        },
      }),
    });

    const draft = await Effect.runPromise(
      service.generateDraft("user-1", {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    expect(draft.qualityReport).toMatchObject({
      status: "warning",
      mode: "enforced",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: "success",
      failureCategory: null,
      qualityReport: expect.objectContaining({
        status: "warning",
        mode: "enforced",
      }),
    });
  });

  it("records regeneration quality failures without replacing the draft", async () => {
    const originalPayload = createModel().generateWeeklyPlan;
    const baseDraft = await Effect.runPromise(
      originalPayload({
        ...createPlannerState(),
        plannerIntent: {
          planGoal: TRAINING_PLAN_GOALS.generalTraining,
        },
        generationMode: "initial",
        parentWeeklyPlanId: null,
        previousPlanWindow: null,
        currentDate: "2026-04-01",
        currentDayOfWeek: DAYS_OF_WEEK.wednesday,
        availability: createPlannerState().availability!,
        historySnapshot: createPlannerState().historySnapshot,
        historyQuality: createPlannerState().historyQuality,
        performanceSnapshot: createPlannerState().performanceSnapshot,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        corexPerceivedAbility: {
          level: "intermediate",
          rationale: "Stable history.",
        },
        longRunDay: DAYS_OF_WEEK.saturday,
        startDate: "2026-04-06",
        startDateDayOfWeek: DAYS_OF_WEEK.monday,
        endDate: "2026-04-12",
        planDurationWeeks: 4,
      }),
    );
    const existingDraft: WeeklyPlanDraft = {
      id: "draft-1",
      userId: "user-1",
      goalId: null,
      parentWeeklyPlanId: null,
      status: "draft",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      generationContext: {
        plannerIntent: {
          planGoal: TRAINING_PLAN_GOALS.generalTraining,
        },
        generationMode: "initial",
        parentWeeklyPlanId: null,
        previousPlanWindow: null,
        currentDate: "2026-04-01",
        currentDayOfWeek: DAYS_OF_WEEK.wednesday,
        availability: createPlannerState().availability!,
        historySnapshot: createPlannerState().historySnapshot,
        historyQuality: createPlannerState().historyQuality,
        performanceSnapshot: createPlannerState().performanceSnapshot,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        corexPerceivedAbility: {
          level: "intermediate",
          rationale: "Stable history.",
        },
        longRunDay: DAYS_OF_WEEK.saturday,
        startDate: "2026-04-06",
        startDateDayOfWeek: DAYS_OF_WEEK.monday,
        endDate: "2026-04-12",
        planDurationWeeks: 4,
      },
      payload: baseDraft,
      qualityReport: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
    let replaceCalled = false;
    const events: Array<
      Parameters<WeeklyPlanningRepository["recordGenerationEvent"]>[0]
    > = [];
    const service = createService({
      model: createExcessiveModel(),
      repo: createRepository({
        getDraftById: () => Effect.succeed(existingDraft),
        replaceDraftGeneration: () => {
          replaceCalled = true;
          return Effect.succeed(null);
        },
        recordGenerationEvent: (input) => {
          events.push(input);
          return Effect.succeed({
            ...input,
            qualityReport: input.qualityReport ?? null,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
          });
        },
      }),
    });

    const exit = await Effect.runPromiseExit(
      service.regenerateDraft("user-1", { draftId: existingDraft.id }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(replaceCalled).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      status: "failure",
      weeklyPlanId: existingDraft.id,
      failureCategory: "quality_guardrail_failure",
      qualityReport: expect.objectContaining({
        status: "blocked",
      }),
    });
  });

  it("saves risky manual edits with an advisory quality report", async () => {
    const context = {
      plannerIntent: {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
      },
      generationMode: "initial" as const,
      parentWeeklyPlanId: null,
      previousPlanWindow: null,
      currentDate: "2026-04-01",
      currentDayOfWeek: DAYS_OF_WEEK.wednesday,
      availability: createPlannerState().availability!,
      historySnapshot: createPlannerState().historySnapshot,
      historyQuality: createPlannerState().historyQuality,
      performanceSnapshot: createPlannerState().performanceSnapshot,
      userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      corexPerceivedAbility: {
        level: "intermediate" as const,
        rationale: "Stable history.",
      },
      longRunDay: DAYS_OF_WEEK.saturday,
      startDate: "2026-04-06",
      startDateDayOfWeek: DAYS_OF_WEEK.monday,
      endDate: "2026-04-12",
      planDurationWeeks: 4,
    };
    const existingDraft: WeeklyPlanDraft = {
      id: "draft-1",
      userId: "user-1",
      goalId: null,
      parentWeeklyPlanId: null,
      status: "draft",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      generationContext: context,
      payload: await Effect.runPromise(
        createModel().generateWeeklyPlan(context),
      ),
      qualityReport: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    };
    const service = createService({
      repo: createRepository({
        getDraftById: () => Effect.succeed(existingDraft),
        updateDraftPayload: (input) =>
          Effect.succeed({
            ...existingDraft,
            payload: input.payload,
            qualityReport: input.qualityReport ?? null,
          }),
      }),
    });

    const updated = await Effect.runPromise(
      service.updateDraftSession("user-1", {
        draftId: existingDraft.id,
        date: "2026-04-06",
        session: {
          sessionType: "easy_run",
          title: "User-entered big run",
          summary: "Manual edit that exceeds recent load",
          coachingNotes: null,
          estimatedDurationSeconds: 2400,
          estimatedDistanceMeters: 50000,
          intervalBlocks: [
            {
              blockType: "steady",
              order: 1,
              repetitions: 1,
              title: "Steady",
              notes: null,
              target: {
                durationSeconds: 2400,
                distanceMeters: null,
                pace: null,
                heartRate: "Z2",
                rpe: 4,
              },
            },
          ],
        },
      }),
    );

    expect(updated.qualityReport).toMatchObject({
      status: "blocked",
      mode: "advisory",
    });
  });
});
