import { beforeEach, describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLivePlanningDataService } from "@corex/api/planning-data/live";
import { createLiveTrainingSettingsService } from "@corex/api/training-settings/live";
import {
  DAYS_OF_WEEK,
  SUPPORTED_RACE_DISTANCES,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
} from "@corex/api/weekly-planning/contracts";
import {
  DraftConflict,
  InvalidStructuredOutput,
  MissingPriorPlan,
} from "@corex/api/weekly-planning/errors";
import type { PlannerModelPort } from "@corex/api/weekly-planning/model";
import { createWeeklyPlanningRepository } from "@corex/api/weekly-planning/repository";
import { createWeeklyPlanningService } from "@corex/api/weekly-planning/service";
import { importedActivity } from "@corex/db/schema/intervals-sync";
import {
  generationEvent as plannerGenerationEvent,
  weeklyPlan as plannerWeeklyPlan,
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

          if (isoDate === "2026-04-11" || isoDate === "2026-04-18") {
            return {
              date: isoDate,
              session: {
                sessionType: "long_run",
                title: "Long run",
                summary: "Long aerobic run",
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
        tuesday: { available: true, maxDurationMinutes: 45 },
        wednesday: { available: true, maxDurationMinutes: 60 },
        thursday: { available: true, maxDurationMinutes: 45 },
        friday: { available: true, maxDurationMinutes: 90 },
        saturday: { available: true, maxDurationMinutes: 120 },
        sunday: { available: true, maxDurationMinutes: 90 },
      },
      intervalsUsername: "runner@example.com",
      intervalsApiKey: "secret-key",
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
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("success");
    expect(events[0]?.goalId).toBeNull();
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
      upstreamActivityId: "run-3",
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
      rawDetail: { id: "run-3" },
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
      model: createFakeModel(),
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
});
