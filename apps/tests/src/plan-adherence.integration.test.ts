import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLivePlanAdherenceService } from "@corex/api/plan-adherence/live";
import { createLivePlanningDataService } from "@corex/api/planning-data/live";
import { createLiveTrainingSettingsService } from "@corex/api/training-settings/live";
import {
  DAYS_OF_WEEK,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
} from "@corex/api/weekly-planning/contracts";
import type { PlannerModelPort } from "@corex/api/weekly-planning/model";
import { createWeeklyPlanningRepository } from "@corex/api/weekly-planning/repository";
import { createWeeklyPlanningService } from "@corex/api/weekly-planning/service";
import { importedActivity } from "@corex/db/schema/intervals-sync";
import { weeklyPlanActivityLink } from "@corex/db/schema/weekly-planning";

import { getIntegrationHarness, resetDatabase } from "./harness";

function createFakeModel(): PlannerModelPort {
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
                summary: "Aerobic",
                coachingNotes: null,
                estimatedDurationSeconds: 600,
                estimatedDistanceMeters: 1000,
                intervalBlocks: [],
              },
            };
          }

          if (index === 1) {
            return {
              date: isoDate,
              session: {
                sessionType: "workout",
                title: "Tempo",
                summary: "Threshold",
                coachingNotes: null,
                estimatedDurationSeconds: 600,
                estimatedDistanceMeters: 1000,
                intervalBlocks: [],
              },
            };
          }

          if (index === 5) {
            return {
              date: isoDate,
              session: {
                sessionType: "long_run",
                title: "Long run",
                summary: "Steady",
                coachingNotes: null,
                estimatedDurationSeconds: 600,
                estimatedDistanceMeters: 1000,
                intervalBlocks: [],
              },
            };
          }

          return { date: isoDate, session: null };
        }),
      }),
  };
}

async function seedAdherenceUser() {
  const { db } = await getIntegrationHarness();
  const user = await createUser(db, {
    email: "plan-adherence@example.com",
    name: "Plan Adherence",
  });
  const trainingSettingsService = createLiveTrainingSettingsService({ db });

  await Effect.runPromise(
    trainingSettingsService.upsertForUser(user.id, {
      availability: {
        monday: { available: true, maxDurationMinutes: 60 },
        tuesday: { available: true, maxDurationMinutes: 60 },
        wednesday: { available: true, maxDurationMinutes: 60 },
        thursday: { available: true, maxDurationMinutes: 60 },
        friday: { available: true, maxDurationMinutes: 60 },
        saturday: { available: true, maxDurationMinutes: 120 },
        sunday: { available: true, maxDurationMinutes: 90 },
      },
      intervalsUsername: "adherence@example.com",
      intervalsApiKey: "secret-key",
      timezone: "Australia/Brisbane",
    }),
  );

  await db.insert(importedActivity).values([
    {
      userId: user.id,
      upstreamActivityId: "run-completed",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Easy completion",
      startAt: new Date("2026-04-06T06:00:00.000Z"),
      movingTimeSeconds: 1800,
      elapsedTimeSeconds: 1800,
      distanceMeters: 5000,
      rawDetail: { id: "run-completed" },
    },
    {
      userId: user.id,
      upstreamActivityId: "run-extra",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Extra jog",
      startAt: new Date("2026-04-08T06:00:00.000Z"),
      movingTimeSeconds: 1200,
      elapsedTimeSeconds: 1200,
      distanceMeters: 3000,
      rawDetail: { id: "run-extra" },
    },
  ]);

  const weeklyPlanningService = createWeeklyPlanningService({
    trainingSettingsService,
    planningDataService: createLivePlanningDataService({ db }),
    repo: createWeeklyPlanningRepository(db),
    model: createFakeModel(),
    clock: { now: () => new Date("2026-04-01T00:00:00.000Z") },
    idGenerator: (() => {
      let index = 0;
      return () => `adherence-plan-${++index}`;
    })(),
  });

  const draft = await Effect.runPromise(
    weeklyPlanningService.generateDraft(user.id, {
      planGoal: TRAINING_PLAN_GOALS.generalTraining,
      startDate: "2026-04-06",
      longRunDay: DAYS_OF_WEEK.saturday,
      planDurationWeeks: 4,
      userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
    }),
  );
  const finalized = await Effect.runPromise(
    weeklyPlanningService.finalizeDraft(user.id, { draftId: draft.id }),
  );

  await db.insert(weeklyPlanActivityLink).values({
    userId: user.id,
    weeklyPlanId: finalized.id,
    plannedDate: "2026-04-06",
    activityId: "run-completed",
  });

  return {
    db,
    user,
    finalized,
  };
}

describe("plan adherence integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("summarizes a finalized weekly plan from links and imported activities", async () => {
    const { db, user, finalized } = await seedAdherenceUser();
    const service = createLivePlanAdherenceService({
      db,
      clock: { now: () => new Date("2026-04-13T00:00:00.000Z") },
    });

    const summary = await Effect.runPromise(
      service.summaryForPlan(user.id, { planId: finalized.id }),
    );

    expect(summary.planId).toBe(finalized.id);
    expect(summary.sessions.map((session) => session.status)).toEqual([
      "completed",
      "missed",
      "missed",
    ]);
    expect(summary.extras).toEqual([
      expect.objectContaining({
        activityId: "run-extra",
        localDate: "2026-04-08",
      }),
    ]);
    expect(summary.totals).toMatchObject({
      plannedSessionCount: 3,
      completedCount: 1,
      missedCount: 2,
      extraCount: 1,
      adheredSessionRatio: 0.3333,
    });
  });
});
