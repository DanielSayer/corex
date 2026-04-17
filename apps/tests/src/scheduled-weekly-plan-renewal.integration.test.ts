import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLivePlanningDataService } from "@corex/api/planning-data/live";
import { createLiveTrainingSettingsService } from "@corex/api/training-settings/live";
import {
  DAYS_OF_WEEK,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
  type WeeklyPlanPayload,
} from "@corex/api/weekly-planning/contracts";
import { ProviderFailure } from "@corex/api/weekly-planning/errors";
import type { PlannerModelPort } from "@corex/api/weekly-planning/model";
import { createWeeklyPlanningRepository } from "@corex/api/weekly-planning/repository";
import { runScheduledWeeklyPlanRenewal } from "@corex/api/weekly-planning/scheduled-renewal";
import { createWeeklyPlanningService } from "@corex/api/weekly-planning/service";
import { importedActivity } from "@corex/db/schema/intervals-sync";
import {
  generationEvent,
  weeklyPlanRenewalJobAttempt,
  weeklyPlanRenewalJobRun,
} from "@corex/db/schema/weekly-planning";

import { getIntegrationHarness, resetDatabase } from "./harness";

const orderedDays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

function dayOfWeek(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return orderedDays[(day + 6) % 7]!;
}

function createGeneratedPlan(startDate: string, longRunDay: string) {
  return {
    days: Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${startDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + index);
      const isoDate = date.toISOString().slice(0, 10);
      const isLongRun = dayOfWeek(isoDate) === longRunDay;
      const isEasyRun =
        dayOfWeek(isoDate) === "monday" || dayOfWeek(isoDate) === "wednesday";

      if (!isLongRun && !isEasyRun) {
        return {
          date: isoDate,
          session: null,
        };
      }

      return {
        date: isoDate,
        session: {
          sessionType: isLongRun ? "long_run" : "easy_run",
          title: isLongRun ? "Long run" : "Easy run",
          summary: isLongRun ? "Long aerobic run" : "Easy aerobic run",
          coachingNotes: null,
          estimatedDurationSeconds: isLongRun ? 600 : 600,
          estimatedDistanceMeters: 1000,
          intervalBlocks: [
            {
              blockType: "steady",
              order: 1,
              repetitions: 1,
              title: isLongRun ? "Long" : "Steady",
              notes: null,
              target: {
                durationSeconds: 600,
                distanceMeters: null,
                pace: null,
                heartRate: "Z2",
                rpe: isLongRun ? 5 : 4,
              },
            },
          ],
        },
      };
    }),
  } satisfies WeeklyPlanPayload;
}

function createFakeModel(
  overrides: Partial<PlannerModelPort> = {},
): PlannerModelPort {
  return {
    provider: "test",
    model: "fake-model",
    generateWeeklyPlan: (context) =>
      Effect.succeed(
        createGeneratedPlan(context.startDate, context.longRunDay),
      ),
    ...overrides,
  };
}

async function saveOptedInSettings(userId: string) {
  const { db } = await getIntegrationHarness();
  const trainingSettingsService = createLiveTrainingSettingsService({ db });

  await Effect.runPromise(
    trainingSettingsService.upsertForUser(userId, {
      availability: {
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: false, maxDurationMinutes: null },
        wednesday: { available: true, maxDurationMinutes: 60 },
        thursday: { available: true, maxDurationMinutes: 45 },
        friday: { available: true, maxDurationMinutes: 90 },
        saturday: { available: true, maxDurationMinutes: 120 },
        sunday: { available: false, maxDurationMinutes: null },
      },
      intervalsUsername: `${userId}@example.com`,
      intervalsApiKey: "secret-key",
      timezone: "Australia/Brisbane",
    }),
  );
  await Effect.runPromise(
    trainingSettingsService.updateAutomaticWeeklyPlanRenewalForUser(userId, {
      enabled: true,
    }),
  );
}

async function insertLocalHistory(userId: string) {
  const { db } = await getIntegrationHarness();

  await db.insert(importedActivity).values([
    {
      userId,
      upstreamActivityId: `${userId}-run-1`,
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
      rawDetail: { id: `${userId}-run-1` },
    },
    {
      userId,
      upstreamActivityId: `${userId}-run-2`,
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
      rawDetail: { id: `${userId}-run-2` },
    },
    {
      userId,
      upstreamActivityId: `${userId}-run-3`,
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
      rawDetail: { id: `${userId}-run-3` },
    },
    {
      userId,
      upstreamActivityId: `${userId}-run-4`,
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
      rawDetail: { id: `${userId}-run-4` },
    },
    {
      userId,
      upstreamActivityId: `${userId}-run-5`,
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
      rawDetail: { id: `${userId}-run-5` },
    },
  ]);
}

function createPlanningService(input: {
  model?: PlannerModelPort;
  idPrefix?: string;
  now?: Date;
}) {
  return getIntegrationHarness().then(({ db }) => {
    let index = 0;

    return createWeeklyPlanningService({
      trainingSettingsService: createLiveTrainingSettingsService({ db }),
      planningDataService: createLivePlanningDataService({ db }),
      repo: createWeeklyPlanningRepository(db),
      model: input.model ?? createFakeModel(),
      clock: { now: () => input.now ?? new Date("2026-04-01T00:00:00.000Z") },
      idGenerator: () => `${input.idPrefix ?? "planner"}-${++index}`,
    });
  });
}

async function seedOptedInPlannerUser(input: {
  email: string;
  draftStartDate?: string;
  finalize?: boolean;
}) {
  const { db } = await getIntegrationHarness();
  const user = await createUser(db, {
    email: input.email,
    name: "Scheduled Renewal",
  });

  await saveOptedInSettings(user.id);
  await insertLocalHistory(user.id);

  const service = await createPlanningService({ idPrefix: user.id });
  const draft = await Effect.runPromise(
    service.generateDraft(user.id, {
      planGoal: TRAINING_PLAN_GOALS.generalTraining,
      startDate: input.draftStartDate ?? "2026-04-06",
      longRunDay: DAYS_OF_WEEK.saturday,
      planDurationWeeks: 4,
      userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
    }),
  );
  const sourcePlan =
    input.finalize === false
      ? draft
      : await Effect.runPromise(
          service.finalizeDraft(user.id, { draftId: draft.id }),
        );

  return { db, user, sourcePlan };
}

describe("scheduled weekly plan renewal integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("generates the next draft from the latest finalized plan and records job outcomes", async () => {
    const { db, user, sourcePlan } = await seedOptedInPlannerUser({
      email: "renewal-success@example.com",
    });

    const result = await Effect.runPromise(
      runScheduledWeeklyPlanRenewal({
        db,
        model: createFakeModel(),
        now: new Date("2026-04-13T00:00:00.000Z"),
        idGenerator: (() => {
          let index = 0;
          return () => `renewal-success-${++index}`;
        })(),
      }),
    );

    const plans = await db.query.weeklyPlan.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
      orderBy: (table, { asc }) => [asc(table.startDate)],
    });
    const events = await db.query.generationEvent.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    });
    const runs = await db.select().from(weeklyPlanRenewalJobRun);
    const attempts = await db.select().from(weeklyPlanRenewalJobAttempt);

    expect(result).toMatchObject({
      status: "success",
      generatedCount: 1,
      existingCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(plans).toHaveLength(2);
    expect(plans[1]).toMatchObject({
      status: "draft",
      startDate: "2026-04-13",
      endDate: "2026-04-19",
      parentWeeklyPlanId: sourcePlan.id,
    });
    expect(events.at(-1)).toMatchObject({
      status: "success",
      weeklyPlanId: plans[1]?.id,
      startDate: "2026-04-13",
    });
    expect(events.at(-1)?.generationContext).toMatchObject({
      generationMode: "renewal",
      parentWeeklyPlanId: sourcePlan.id,
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: "success",
      generatedCount: 1,
      existingCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      runId: runs[0]?.id,
      userId: user.id,
      timezone: "Australia/Brisbane",
      sourceWeeklyPlanId: sourcePlan.id,
      generatedWeeklyPlanId: plans[1]?.id,
      targetStartDate: "2026-04-13",
      targetEndDate: "2026-04-19",
      status: "generated",
      failureSummary: null,
    });
  });

  it("records existing draft on rerun and does not duplicate the renewed week", async () => {
    const { db, user } = await seedOptedInPlannerUser({
      email: "renewal-existing@example.com",
    });

    await Effect.runPromise(
      runScheduledWeeklyPlanRenewal({
        db,
        model: createFakeModel(),
        now: new Date("2026-04-13T00:00:00.000Z"),
      }),
    );
    const second = await Effect.runPromise(
      runScheduledWeeklyPlanRenewal({
        db,
        model: createFakeModel(),
        now: new Date("2026-04-13T00:00:00.000Z"),
      }),
    );

    const drafts = await db.query.weeklyPlan.findMany({
      where: (table, { and, eq }) =>
        and(
          eq(table.userId, user.id),
          eq(table.status, "draft"),
          eq(table.startDate, "2026-04-13"),
        ),
    });
    const attempts = await db.select().from(weeklyPlanRenewalJobAttempt);

    expect(second).toMatchObject({
      status: "success",
      generatedCount: 0,
      existingCount: 1,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(drafts).toHaveLength(1);
    expect(attempts.at(-1)).toMatchObject({
      status: "existing_draft",
      generatedWeeklyPlanId: drafts[0]?.id,
      targetStartDate: "2026-04-13",
    });
  });

  it("records skipped_missing_settings for opted-in users without complete settings", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "renewal-missing-settings@example.com",
      name: "Missing Settings",
    });

    await Effect.runPromise(
      createLiveTrainingSettingsService({
        db,
      }).updateAutomaticWeeklyPlanRenewalForUser(user.id, { enabled: true }),
    );

    const result = await Effect.runPromise(
      runScheduledWeeklyPlanRenewal({
        db,
        model: createFakeModel(),
        now: new Date("2026-04-13T00:00:00.000Z"),
      }),
    );
    const attempts = await db.select().from(weeklyPlanRenewalJobAttempt);

    expect(result).toMatchObject({
      generatedCount: 0,
      existingCount: 0,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      userId: user.id,
      timezone: "UTC",
      status: "skipped_missing_settings",
      sourceWeeklyPlanId: null,
      generatedWeeklyPlanId: null,
    });
  });

  it("requires the latest stored plan to be finalized for automatic renewal", async () => {
    const { db, user } = await seedOptedInPlannerUser({
      email: "renewal-latest-draft@example.com",
      finalize: false,
    });

    const result = await Effect.runPromise(
      runScheduledWeeklyPlanRenewal({
        db,
        model: createFakeModel(),
        now: new Date("2026-04-13T00:00:00.000Z"),
      }),
    );
    const attempts = await db.select().from(weeklyPlanRenewalJobAttempt);
    const plans = await db.query.weeklyPlan.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(result.skippedCount).toBe(1);
    expect(attempts[0]).toMatchObject({
      status: "skipped_no_finalized_plan",
    });
    expect(plans).toHaveLength(1);
  });

  it("records skipped_not_due while the finalized plan has not ended locally", async () => {
    const { db } = await seedOptedInPlannerUser({
      email: "renewal-not-due@example.com",
      draftStartDate: "2026-04-13",
    });

    const result = await Effect.runPromise(
      runScheduledWeeklyPlanRenewal({
        db,
        model: createFakeModel(),
        now: new Date("2026-04-13T00:00:00.000Z"),
      }),
    );
    const attempts = await db.select().from(weeklyPlanRenewalJobAttempt);

    expect(result.skippedCount).toBe(1);
    expect(attempts[0]).toMatchObject({
      status: "skipped_not_due",
      targetStartDate: "2026-04-20",
      targetEndDate: "2026-04-26",
    });
  });

  it("records skipped_no_local_history without attempting generation", async () => {
    const { db, user } = await seedOptedInPlannerUser({
      email: "renewal-no-history@example.com",
    });

    await db
      .delete(importedActivity)
      .where(eq(importedActivity.userId, user.id));

    const result = await Effect.runPromise(
      runScheduledWeeklyPlanRenewal({
        db,
        model: createFakeModel(),
        now: new Date("2026-04-13T00:00:00.000Z"),
      }),
    );
    const attempts = await db.select().from(weeklyPlanRenewalJobAttempt);
    const events = await db.select().from(generationEvent);

    expect(result.skippedCount).toBe(1);
    expect(attempts[0]).toMatchObject({
      status: "skipped_no_local_history",
    });
    expect(events).toHaveLength(1);
  });

  it("records failed attempts and failure generation events when renewal generation fails", async () => {
    const { db, user } = await seedOptedInPlannerUser({
      email: "renewal-failed@example.com",
    });

    const result = await Effect.runPromise(
      runScheduledWeeklyPlanRenewal({
        db,
        model: createFakeModel({
          generateWeeklyPlan: () =>
            Effect.fail(
              new ProviderFailure({
                message: "provider unavailable with token secret-value",
              }),
            ),
        }),
        now: new Date("2026-04-13T00:00:00.000Z"),
      }),
    );
    const attempts = await db.select().from(weeklyPlanRenewalJobAttempt);
    const events = await db.query.generationEvent.findMany({
      where: (table, { eq }) => eq(table.userId, user.id),
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    });

    expect(result).toMatchObject({
      status: "partial_failure",
      generatedCount: 0,
      existingCount: 0,
      skippedCount: 0,
      failedCount: 1,
    });
    expect(attempts[0]).toMatchObject({
      status: "failed",
      generatedWeeklyPlanId: null,
    });
    expect(attempts[0]?.failureSummary).toContain("provider unavailable");
    expect(events.at(-1)).toMatchObject({
      status: "failure",
      startDate: "2026-04-13",
      weeklyPlanId: null,
    });
    expect(events.at(-1)?.generationContext).toMatchObject({
      generationMode: "renewal",
    });
  });
});
