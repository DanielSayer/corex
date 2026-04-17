import { beforeEach, describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLivePlanAdherenceService } from "@corex/api/plan-adherence/live";
import { createLivePlanningDataService } from "@corex/api/planning-data/live";
import { createLiveTrainingSettingsService } from "@corex/api/training-settings/live";
import {
  DAYS_OF_WEEK,
  INTERVAL_BLOCK_TYPES,
  SESSION_TYPES,
  SUPPORTED_RACE_DISTANCES,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
  type WeeklyPlanPayload,
} from "@corex/api/weekly-planning/contracts";
import {
  DraftNotFound,
  DraftConflict,
  InvalidStructuredOutput,
  MissingPriorPlan,
  PlanFinalizationConflict,
  WeeklyPlanningValidationError,
} from "@corex/api/weekly-planning/errors";
import type { PlannerModelPort } from "@corex/api/weekly-planning/model";
import { createWeeklyPlanningRepository } from "@corex/api/weekly-planning/repository";
import { createWeeklyPlanningService } from "@corex/api/weekly-planning/service";
import { importedActivity } from "@corex/db/schema/intervals-sync";
import {
  generationEvent as plannerGenerationEvent,
  weeklyPlan as plannerWeeklyPlan,
  weeklyPlanActivityLink,
} from "@corex/db/schema/weekly-planning";

import { getIntegrationHarness, resetDatabase } from "./harness";

function createFakeModel(
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
                title: "Easy run",
                summary: "Easy aerobic run",
                coachingNotes: null,
                estimatedDurationSeconds: 600,
                estimatedDistanceMeters: 2000,
                intervalBlocks: [
                  {
                    blockType: "steady",
                    order: 1,
                    repetitions: 1,
                    title: "Steady",
                    notes: null,
                    target: {
                      durationSeconds: 600,
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
                title: "Aerobic run",
                summary: "Easy aerobic run",
                coachingNotes: null,
                estimatedDurationSeconds: 600,
                estimatedDistanceMeters: 2000,
                intervalBlocks: [
                  {
                    blockType: "steady",
                    order: 1,
                    repetitions: 1,
                    title: "Steady",
                    notes: null,
                    target: {
                      durationSeconds: 600,
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

          if (isoDate === "2026-04-11" || isoDate === "2026-04-18") {
            return {
              date: isoDate,
              session: {
                sessionType: "long_run",
                title: "Long run",
                summary: "Long aerobic run",
                coachingNotes: null,
                estimatedDurationSeconds: 600,
                estimatedDistanceMeters: 2000,
                intervalBlocks: [
                  {
                    blockType: "steady",
                    order: 1,
                    repetitions: 1,
                    title: "Long",
                    notes: null,
                    target: {
                      durationSeconds: 600,
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

function createExcessiveGeneratedPlan(startDate: string): WeeklyPlanPayload {
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
        const durationSeconds = index === 0 ? 2400 : 3000;

        return {
          date: isoDate,
          session: {
            sessionType: "easy_run",
            title: "Big easy run",
            summary: "Too much weekly load",
            coachingNotes: null,
            estimatedDurationSeconds: durationSeconds,
            estimatedDistanceMeters: 15000,
            intervalBlocks: [
              {
                blockType: "steady",
                order: 1,
                repetitions: 1,
                title: "Steady",
                notes: null,
                target: {
                  durationSeconds,
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

async function seedPlannerUser() {
  const { db } = await getIntegrationHarness();
  const user = await createUser(db, {
    email: "planner-phase5@example.com",
    name: "Planner Phase 5",
  });
  const trainingSettingsService = createLiveTrainingSettingsService({ db });

  await Effect.runPromise(
    trainingSettingsService.upsertForUser(user.id, {
      availability: {
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: false, maxDurationMinutes: null },
        wednesday: { available: true, maxDurationMinutes: 60 },
        thursday: { available: true, maxDurationMinutes: 45 },
        friday: { available: true, maxDurationMinutes: 90 },
        saturday: { available: true, maxDurationMinutes: 120 },
        sunday: { available: true, maxDurationMinutes: 90 },
      },
      intervalsUsername: "runner@example.com",
      intervalsApiKey: "secret-key",
      timezone: "Australia/Brisbane",
    }),
  );

  await db.insert(importedActivity).values([
    {
      userId: user.id,
      upstreamActivityId: "run-1",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-30T00:00:00.000Z"),
      movingTimeSeconds: 3200,
      elapsedTimeSeconds: 3250,
      distanceMeters: 10000,
      totalElevationGainMeters: 90,
      averageSpeedMetersPerSecond: 3.1,
      averageHeartrate: 150,
      rawDetail: { id: "run-1" },
    },
    {
      userId: user.id,
      upstreamActivityId: "run-2",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-27T00:00:00.000Z"),
      movingTimeSeconds: 1800,
      elapsedTimeSeconds: 1810,
      distanceMeters: 5000,
      totalElevationGainMeters: 40,
      averageSpeedMetersPerSecond: 2.8,
      averageHeartrate: 145,
      rawDetail: { id: "run-2" },
    },
    {
      userId: user.id,
      upstreamActivityId: "run-3",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-24T00:00:00.000Z"),
      movingTimeSeconds: 2400,
      elapsedTimeSeconds: 2410,
      distanceMeters: 7000,
      totalElevationGainMeters: 35,
      averageSpeedMetersPerSecond: 2.9,
      averageHeartrate: 146,
      rawDetail: { id: "run-3" },
    },
    {
      userId: user.id,
      upstreamActivityId: "run-4",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-20T00:00:00.000Z"),
      movingTimeSeconds: 3100,
      elapsedTimeSeconds: 3120,
      distanceMeters: 10000,
      totalElevationGainMeters: 80,
      averageSpeedMetersPerSecond: 3.1,
      averageHeartrate: 148,
      rawDetail: { id: "run-4" },
    },
    {
      userId: user.id,
      upstreamActivityId: "run-5",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-17T00:00:00.000Z"),
      movingTimeSeconds: 2700,
      elapsedTimeSeconds: 2720,
      distanceMeters: 8000,
      totalElevationGainMeters: 60,
      averageSpeedMetersPerSecond: 3,
      averageHeartrate: 147,
      rawDetail: { id: "run-5" },
    },
  ]);

  const service = createWeeklyPlanningService({
    trainingSettingsService: createLiveTrainingSettingsService({ db }),
    planningDataService: createLivePlanningDataService({ db }),
    repo: createWeeklyPlanningRepository(db),
    model: createFakeModel(),
    clock: { now: () => new Date("2026-04-01T00:00:00.000Z") },
    idGenerator: (() => {
      let index = 0;
      return () => `planner-${++index}`;
    })(),
  });

  return { db, user, service };
}

describe("weekly planning integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns planner state with user-scoped data", async () => {
    const { user, service } = await seedPlannerUser();

    const state = await Effect.runPromise(service.getState(user.id));

    expect(state.planGoalOptions).toHaveLength(7);
    expect(state.availability?.saturday.maxDurationMinutes).toBe(120);
    expect(state.historyQuality.hasAnyHistory).toBe(true);
    expect(state.activeDraft).toBeNull();
    expect(state.currentFinalizedPlan).toBeNull();
  });

  it("persists a draft and generation event on successful generation", async () => {
    const { db, user, service } = await seedPlannerUser();

    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
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

    expect(draft.id).toBe("planner-1");

    const storedDraft = await db.query.weeklyPlan.findFirst({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const events = await db.select().from(plannerGenerationEvent);

    expect(storedDraft?.startDate).toBe("2026-04-06");
    expect(storedDraft?.goalId).toBeNull();
    expect(storedDraft?.qualityReport).toMatchObject({
      status: "pass",
      mode: "enforced",
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("success");
    expect(events[0]?.goalId).toBeNull();
    expect(events[0]?.qualityReport).toMatchObject({
      status: "pass",
      mode: "enforced",
    });
  });

  it("records a failed generation event and does not persist a draft for invalid model output", async () => {
    const { db, user } = await seedPlannerUser();
    const service = createWeeklyPlanningService({
      trainingSettingsService: createLiveTrainingSettingsService({ db }),
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: createFakeModel({
        generateWeeklyPlan: () =>
          Effect.succeed({
            days: Array.from({ length: 7 }, (_, index) => ({
              date: `2026-04-${String(index + 6).padStart(2, "0")}`,
              session: null,
            })),
          }),
      }),
      clock: { now: () => new Date("2026-04-01T00:00:00.000Z") },
      idGenerator: (() => {
        let index = 0;
        return () => `planner-invalid-${++index}`;
      })(),
    });

    const exit = await Effect.runPromiseExit(
      service.generateDraft(user.id, {
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

    const drafts = await db.select().from(plannerWeeklyPlan);
    const events = await db.select().from(plannerGenerationEvent);

    expect(drafts).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("failure");
  });

  it("records a failed generation event and no draft for quality guardrail failures", async () => {
    const { db, user } = await seedPlannerUser();
    const service = createWeeklyPlanningService({
      trainingSettingsService: createLiveTrainingSettingsService({ db }),
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: createFakeModel({
        generateWeeklyPlan: (context) =>
          Effect.succeed(createExcessiveGeneratedPlan(context.startDate)),
      }),
      clock: { now: () => new Date("2026-04-01T00:00:00.000Z") },
      idGenerator: (() => {
        let index = 0;
        return () => `planner-quality-${++index}`;
      })(),
    });

    const exit = await Effect.runPromiseExit(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    const drafts = await db.select().from(plannerWeeklyPlan);
    const events = await db.select().from(plannerGenerationEvent);

    expect(drafts).toHaveLength(0);
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

  it("blocks a second generation for the same start date", async () => {
    const { db, user, service } = await seedPlannerUser();

    await Effect.runPromise(
      service.generateDraft(user.id, {
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

    const exit = await Effect.runPromiseExit(
      service.generateDraft(user.id, {
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
        expect(failure.value).toBeInstanceOf(DraftConflict);
      }
    }

    const drafts = await db.select().from(plannerWeeklyPlan);
    expect(drafts).toHaveLength(1);
  });

  it("generates the next chronological week from the latest stored plan and preserves prior drafts", async () => {
    const { db, user, service } = await seedPlannerUser();

    const firstDraft = await Effect.runPromise(
      service.generateDraft(user.id, {
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

    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "run-next-week",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-04-08T00:00:00.000Z"),
      movingTimeSeconds: 2400,
      elapsedTimeSeconds: 2410,
      distanceMeters: 7000,
      totalElevationGainMeters: 55,
      averageSpeedMetersPerSecond: 2.9,
      averageHeartrate: 152,
      rawDetail: { id: "run-next-week" },
    });

    const nextDraft = await Effect.runPromise(
      service.generateNextWeek(user.id),
    );

    expect(nextDraft.startDate).toBe("2026-04-13");
    expect(nextDraft.endDate).toBe("2026-04-19");
    expect(nextDraft.generationContext.plannerIntent).toEqual(
      firstDraft.generationContext.plannerIntent,
    );
    expect(nextDraft.generationContext.planDurationWeeks).toBe(4);
    expect(nextDraft.generationContext.startDate).toBe("2026-04-13");
    expect(nextDraft.generationContext.previousPlanWindow).toEqual({
      startDate: "2026-04-06",
      endDate: "2026-04-12",
    });
    expect(nextDraft.generationContext.priorPlanAdherence).toBeNull();
    expect(nextDraft.generationContext.generationMode).toBe("renewal");
    expect(nextDraft.generationContext.parentWeeklyPlanId).toBe(firstDraft.id);
    expect(nextDraft.generationContext.historySnapshot.detailedRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          distanceMeters: 7000,
        }),
      ]),
    );

    const drafts = await db.query.weeklyPlan.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
      orderBy: (table, { asc }) => [asc(table.startDate)],
    });
    const events = await db.select().from(plannerGenerationEvent);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({
      id: firstDraft.id,
      status: "draft",
      startDate: "2026-04-06",
    });
    expect(drafts[1]).toMatchObject({
      id: nextDraft.id,
      status: "draft",
      startDate: "2026-04-13",
      parentWeeklyPlanId: firstDraft.id,
    });
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      status: "success",
      weeklyPlanId: nextDraft.id,
      startDate: "2026-04-13",
    });
  });

  it("rejects next-week generation when no prior stored week exists", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "planner-no-prior@example.com",
      name: "No Prior Planner",
    });
    const service = createWeeklyPlanningService({
      trainingSettingsService: createLiveTrainingSettingsService({ db }),
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: createFakeModel(),
      clock: { now: () => new Date("2026-04-01T00:00:00.000Z") },
    });

    const exit = await Effect.runPromiseExit(service.generateNextWeek(user.id));

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(MissingPriorPlan);
      }
    }
  });

  it("supports below-threshold users when local history exists", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "planner-low-history@example.com",
      name: "Low History",
    });
    const trainingSettingsService = createLiveTrainingSettingsService({ db });
    await Effect.runPromise(
      trainingSettingsService.upsertForUser(user.id, {
        availability: {
          monday: { available: true, maxDurationMinutes: 45 },
          tuesday: { available: true, maxDurationMinutes: 45 },
          wednesday: { available: true, maxDurationMinutes: 45 },
          thursday: { available: true, maxDurationMinutes: 45 },
          friday: { available: true, maxDurationMinutes: 45 },
          saturday: { available: true, maxDurationMinutes: 90 },
          sunday: { available: true, maxDurationMinutes: 90 },
        },
        intervalsUsername: "runner@example.com",
        intervalsApiKey: "secret-key",
        timezone: "Australia/Brisbane",
      }),
    );

    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "run-low-1",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-30T00:00:00.000Z"),
      movingTimeSeconds: 1800,
      elapsedTimeSeconds: 1810,
      distanceMeters: 5000,
      rawDetail: { id: "run-low-1" },
    });

    const service = createWeeklyPlanningService({
      trainingSettingsService,
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: createFakeModel({
        generateWeeklyPlan: (context) =>
          Effect.succeed({
            days: Array.from({ length: 7 }, (_, index) => {
              const date = new Date(`${context.startDate}T00:00:00.000Z`);
              date.setUTCDate(date.getUTCDate() + index);
              const isoDate = date.toISOString().slice(0, 10);

              if (index === 0 || index === 2 || index === 5) {
                return {
                  date: isoDate,
                  session: {
                    sessionType: index === 5 ? "long_run" : "easy_run",
                    title: index === 5 ? "Intro long run" : "Intro easy run",
                    summary: "Conservative low-history run",
                    coachingNotes: null,
                    estimatedDurationSeconds: 600,
                    estimatedDistanceMeters: 2000,
                    intervalBlocks: [
                      {
                        blockType: "steady",
                        order: 1,
                        repetitions: 1,
                        title: "Steady",
                        notes: null,
                        target: {
                          durationSeconds: 600,
                          distanceMeters: null,
                          pace: null,
                          heartRate: "Z2",
                          rpe: 3,
                        },
                      },
                    ],
                  },
                };
              }

              return { date: isoDate, session: null };
            }),
          }),
      }),
      clock: { now: () => new Date("2026-04-01T00:00:00.000Z") },
    });

    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.race,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 6,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.beginner,
        raceBenchmark: {
          estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["5k"],
          estimatedRaceTimeSeconds: 1800,
        },
      }),
    );

    expect(draft.status).toBe("draft");
  });

  it("edits an existing draft session without creating a new weekly plan row", async () => {
    const { db, user, service } = await seedPlannerUser();
    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    const edited = await Effect.runPromise(
      service.updateDraftSession(user.id, {
        draftId: draft.id,
        date: "2026-04-06",
        session: {
          sessionType: SESSION_TYPES.easyRun,
          title: "Short aerobic run",
          summary: "Keep this deliberately short before work.",
          coachingNotes: "Stop early if the legs feel flat.",
          estimatedDurationSeconds: 1500,
          estimatedDistanceMeters: 4200,
          intervalBlocks: [
            {
              blockType: INTERVAL_BLOCK_TYPES.steady,
              order: 1,
              repetitions: 1,
              title: "Gentle aerobic block",
              notes: null,
              target: {
                durationSeconds: 1500,
                distanceMeters: null,
                pace: null,
                heartRate: "Z2",
                rpe: 3,
              },
            },
          ],
        },
      }),
    );

    expect(edited.id).toBe(draft.id);
    expect(edited.payload.days[0]?.session).toMatchObject({
      title: "Short aerobic run",
      estimatedDurationSeconds: 1500,
      estimatedDistanceMeters: 4200,
    });

    const storedDrafts = await db.query.weeklyPlan.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(storedDrafts).toHaveLength(1);
    expect(storedDrafts[0]?.id).toBe(draft.id);
    expect(storedDrafts[0]?.payload).toEqual(edited.payload);
  });

  it("rejects draft edits for plans owned by another user", async () => {
    const primary = await seedPlannerUser();
    const otherUser = await createUser(primary.db, {
      email: "planner-other-owner@example.com",
      name: "Other Planner",
    });
    const draft = await Effect.runPromise(
      primary.service.generateDraft(primary.user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    const exit = await Effect.runPromiseExit(
      primary.service.updateDraftSession(otherUser.id, {
        draftId: draft.id,
        date: "2026-04-06",
        session: draft.payload.days[0]!.session!,
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(DraftNotFound);
      }
    }
  });

  it("rejects moving a draft session to an unavailable day", async () => {
    const { user, service } = await seedPlannerUser();
    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    const exit = await Effect.runPromiseExit(
      service.moveDraftSession(user.id, {
        draftId: draft.id,
        fromDate: "2026-04-06",
        toDate: "2026-04-07",
        mode: "move",
      }),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(WeeklyPlanningValidationError);
      }
    }
  });

  it("regenerates a selected draft in place and records regeneration mode", async () => {
    const { db, user, service } = await seedPlannerUser();
    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    const regeneratingService = createWeeklyPlanningService({
      trainingSettingsService: createLiveTrainingSettingsService({ db }),
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: createFakeModel({
        generateWeeklyPlan: (context) =>
          Effect.succeed({
            days: Array.from({ length: 7 }, (_, index) => {
              const date = new Date(`${context.startDate}T00:00:00.000Z`);
              date.setUTCDate(date.getUTCDate() + index);
              const isoDate = date.toISOString().slice(0, 10);

              if (index === 2) {
                return {
                  date: isoDate,
                  session: {
                    sessionType: "workout",
                    title: "Regenerated workout",
                    summary: "Fresh midweek workout",
                    coachingNotes: null,
                    estimatedDurationSeconds: 2700,
                    estimatedDistanceMeters: 8000,
                    intervalBlocks: [
                      {
                        blockType: "warmup",
                        order: 1,
                        repetitions: 1,
                        title: "Warm up",
                        notes: null,
                        target: {
                          durationSeconds: 600,
                          distanceMeters: null,
                          pace: null,
                          heartRate: "Z2",
                          rpe: 3,
                        },
                      },
                      {
                        blockType: "work",
                        order: 2,
                        repetitions: 4,
                        title: "Controlled reps",
                        notes: null,
                        target: {
                          durationSeconds: 300,
                          distanceMeters: null,
                          pace: null,
                          heartRate: null,
                          rpe: 7,
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
                    title: "Regenerated long run",
                    summary: "Fresh long run",
                    coachingNotes: null,
                    estimatedDurationSeconds: 1800,
                    estimatedDistanceMeters: 5000,
                    intervalBlocks: [
                      {
                        blockType: "steady",
                        order: 1,
                        repetitions: 1,
                        title: "Long aerobic block",
                        notes: null,
                        target: {
                          durationSeconds: 1800,
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

              return { date: isoDate, session: null };
            }),
          }),
      }),
      clock: { now: () => new Date("2026-04-02T00:00:00.000Z") },
      idGenerator: (() => {
        let index = 0;
        return () => `planner-regen-${++index}`;
      })(),
    });

    const regenerated = await Effect.runPromise(
      regeneratingService.regenerateDraft(user.id, { draftId: draft.id }),
    );

    expect(regenerated.id).toBe(draft.id);
    expect(regenerated.status).toBe("draft");
    expect(regenerated.generationContext.generationMode).toBe("regeneration");
    expect(regenerated.payload.days[2]?.session).toMatchObject({
      title: "Regenerated workout",
    });
    expect(regenerated.payload.days[0]?.session).toBeNull();

    const storedDrafts = await db.query.weeklyPlan.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const events = await db.query.generationEvent.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    });

    expect(storedDrafts).toHaveLength(1);
    expect(storedDrafts[0]?.id).toBe(draft.id);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      status: "success",
      weeklyPlanId: draft.id,
      startDate: "2026-04-06",
    });
    expect(events[1]?.generationContext).toMatchObject({
      generationMode: "regeneration",
    });
  });

  it("finalizes an owned draft and returns it in newest-first history", async () => {
    const { db, user, service } = await seedPlannerUser();
    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    const finalized = await Effect.runPromise(
      service.finalizeDraft(user.id, { draftId: draft.id }),
    );
    const storedPlan = await db.query.weeklyPlan.findFirst({
      where: (table, { eq }) => eq(table.id, draft.id),
    });

    expect(finalized).toMatchObject({
      id: draft.id,
      status: "finalized",
      startDate: "2026-04-06",
      payload: draft.payload,
    });
    expect(storedPlan?.status).toBe("finalized");

    const nextDraft = await Effect.runPromise(
      service.generateNextWeek(user.id),
    );
    await Effect.runPromise(
      service.finalizeDraft(user.id, { draftId: nextDraft.id }),
    );

    const firstPage = await Effect.runPromise(
      service.listFinalizedPlans(user.id, { limit: 1, offset: 0 }),
    );
    const secondPage = await Effect.runPromise(
      service.listFinalizedPlans(user.id, { limit: 1, offset: 1 }),
    );

    expect(firstPage.items.map((plan) => plan.startDate)).toEqual([
      "2026-04-13",
    ]);
    expect(firstPage.nextOffset).toBe(1);
    expect(secondPage.items.map((plan) => plan.startDate)).toEqual([
      "2026-04-06",
    ]);
    expect(secondPage.nextOffset).toBeNull();
  });

  it("includes finalized prior-plan adherence in next-week generation context", async () => {
    const { db, user, service } = await seedPlannerUser();
    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "run-adherence-completed",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-04-06T06:00:00.000Z"),
      movingTimeSeconds: 1200,
      elapsedTimeSeconds: 1200,
      distanceMeters: 4000,
      rawDetail: { id: "run-adherence-completed" },
    });
    await Effect.runPromise(
      service.finalizeDraft(user.id, { draftId: draft.id }),
    );
    await db.insert(weeklyPlanActivityLink).values({
      userId: user.id,
      weeklyPlanId: draft.id,
      plannedDate: "2026-04-06",
      activityId: "run-adherence-completed",
    });

    const serviceWithAdherence = createWeeklyPlanningService({
      trainingSettingsService: createLiveTrainingSettingsService({ db }),
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: createFakeModel(),
      planAdherenceService: createLivePlanAdherenceService({
        db,
        clock: { now: () => new Date("2026-04-13T00:00:00.000Z") },
      }),
      clock: { now: () => new Date("2026-04-13T00:00:00.000Z") },
      idGenerator: (() => {
        let index = 0;
        return () => `planner-adherence-${++index}`;
      })(),
    });

    const nextDraft = await Effect.runPromise(
      serviceWithAdherence.generateNextWeek(user.id),
    );

    expect(nextDraft.generationContext.priorPlanAdherence).toMatchObject({
      planId: draft.id,
      totals: {
        plannedSessionCount: 3,
        completedCount: 1,
        missedCount: 2,
      },
    });
  });

  it("rejects cross-user and repeated draft finalization without changing the draft", async () => {
    const { db, user, service } = await seedPlannerUser();
    const otherUser = await createUser(db, {
      email: "planner-finalize-other@example.com",
      name: "Finalize Other",
    });
    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );

    const crossUserExit = await Effect.runPromiseExit(
      service.finalizeDraft(otherUser.id, { draftId: draft.id }),
    );
    const afterCrossUserAttempt = await db.query.weeklyPlan.findFirst({
      where: (table, { eq }) => eq(table.id, draft.id),
    });
    await Effect.runPromise(
      service.finalizeDraft(user.id, { draftId: draft.id }),
    );
    const repeatedExit = await Effect.runPromiseExit(
      service.finalizeDraft(user.id, { draftId: draft.id }),
    );

    expect(Exit.isFailure(crossUserExit)).toBe(true);
    expect(afterCrossUserAttempt?.status).toBe("draft");
    expect(Exit.isFailure(repeatedExit)).toBe(true);

    for (const exit of [crossUserExit, repeatedExit]) {
      if (Exit.isFailure(exit)) {
        const failure = Cause.failureOption(exit.cause);
        expect(Option.isSome(failure)).toBe(true);

        if (Option.isSome(failure)) {
          expect(failure.value).toBeInstanceOf(DraftNotFound);
        }
      }
    }
  });

  it("allows same-week draft experiments but rejects overlapping finalization", async () => {
    const { user, service } = await seedPlannerUser();
    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );
    await Effect.runPromise(
      service.finalizeDraft(user.id, { draftId: draft.id }),
    );

    const experimentalDraft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );
    const exit = await Effect.runPromiseExit(
      service.finalizeDraft(user.id, { draftId: experimentalDraft.id }),
    );

    expect(experimentalDraft.status).toBe("draft");
    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(PlanFinalizationConflict);
      }
    }
  });

  it("returns the current finalized plan from planner state using the stored timezone", async () => {
    const { db, user, service } = await seedPlannerUser();
    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        planGoal: TRAINING_PLAN_GOALS.generalTraining,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
      }),
    );
    await Effect.runPromise(
      service.finalizeDraft(user.id, { draftId: draft.id }),
    );
    const currentWeekService = createWeeklyPlanningService({
      trainingSettingsService: createLiveTrainingSettingsService({ db }),
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: createFakeModel(),
      clock: { now: () => new Date("2026-04-07T15:00:00.000Z") },
    });

    const state = await Effect.runPromise(currentWeekService.getState(user.id));

    expect(state.currentFinalizedPlan).toMatchObject({
      id: draft.id,
      status: "finalized",
      startDate: "2026-04-06",
    });
  });
});
