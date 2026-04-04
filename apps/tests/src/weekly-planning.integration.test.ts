import { beforeEach, describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLiveGoalsApi } from "@corex/api/goals/live";
import { createLivePlanningDataService } from "@corex/api/planning-data/live";
import { createLiveTrainingSettingsService } from "@corex/api/training-settings/live";
import {
  DAYS_OF_WEEK,
  SUPPORTED_RACE_DISTANCES,
  USER_PERCEIVED_ABILITY_LEVELS,
} from "@corex/api/weekly-planning/contracts";
import {
  DraftConflict,
  InvalidStructuredOutput,
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
    generateWeeklyPlan: () =>
      Effect.succeed({
        days: [
          {
            date: "2026-04-06",
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
          },
          { date: "2026-04-12", session: null },
        ],
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

  const goalsApi = createLiveGoalsApi({ db });

  const goal = await Effect.runPromise(
    goalsApi.createForUser(user.id, {
      type: "volume_goal",
      metric: "distance",
      period: "week",
      targetValue: 40,
      unit: "km",
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
    goalsApi,
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

  return { db, user, goal, service };
}

describe("weekly planning integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns planner state with user-scoped data", async () => {
    const { user, service } = await seedPlannerUser();

    const state = await Effect.runPromise(service.getState(user.id));

    expect(state.goalCandidates).toHaveLength(1);
    expect(state.availability?.saturday.maxDurationMinutes).toBe(120);
    expect(state.historyQuality.hasAnyHistory).toBe(true);
    expect(state.activeDraft).toBeNull();
  });

  it("persists a draft and generation event on successful generation", async () => {
    const { db, user, goal, service } = await seedPlannerUser();

    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        goalId: goal.id,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
      }),
    );

    expect(draft.id).toBe("planner-1");

    const storedDraft = await db.query.weeklyPlan.findFirst({
      where: (table, { eq }) => eq(table.userId, user.id),
    });
    const events = await db.select().from(plannerGenerationEvent);

    expect(storedDraft?.startDate).toBe("2026-04-06");
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("success");
  });

  it("records a failed generation event and does not persist a draft for invalid model output", async () => {
    const { db, user, goal } = await seedPlannerUser();
    const service = createWeeklyPlanningService({
      goalsApi: createLiveGoalsApi({ db }),
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
        goalId: goal.id,
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

    const drafts = await db.select().from(plannerWeeklyPlan);
    const events = await db.select().from(plannerGenerationEvent);

    expect(drafts).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.status).toBe("failure");
  });

  it("blocks a second generation when an active draft already exists", async () => {
    const { db, user, goal, service } = await seedPlannerUser();

    await Effect.runPromise(
      service.generateDraft(user.id, {
        goalId: goal.id,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 4,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
      }),
    );

    const exit = await Effect.runPromiseExit(
      service.generateDraft(user.id, {
        goalId: goal.id,
        startDate: "2026-04-13",
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

    const drafts = await db.select().from(plannerWeeklyPlan);
    expect(drafts).toHaveLength(1);
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

    const goalsApi = createLiveGoalsApi({ db });
    const goal = await Effect.runPromise(
      goalsApi.createForUser(user.id, {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 25,
        unit: "km",
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
      goalsApi,
      trainingSettingsService,
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: createFakeModel(),
      clock: { now: () => new Date("2026-04-01T00:00:00.000Z") },
    });

    const draft = await Effect.runPromise(
      service.generateDraft(user.id, {
        goalId: goal.id,
        startDate: "2026-04-06",
        longRunDay: DAYS_OF_WEEK.saturday,
        planDurationWeeks: 6,
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.beginner,
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["5k"],
        estimatedRaceTimeSeconds: 1800,
      }),
    );

    expect(draft.status).toBe("draft");
  });
});
