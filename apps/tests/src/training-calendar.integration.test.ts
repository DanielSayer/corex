import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createLiveTrainingSettingsService } from "@corex/api/training-settings/live";
import {
  DAYS_OF_WEEK,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
} from "@corex/api/weekly-planning/contracts";
import type { PlannerModelPort } from "@corex/api/weekly-planning/model";
import { createWeeklyPlanningRepository } from "@corex/api/weekly-planning/repository";
import { createWeeklyPlanningService } from "@corex/api/weekly-planning/service";
import { createLivePlanningDataService } from "@corex/api/planning-data/live";
import { createLiveTrainingCalendarService } from "@corex/api/training-calendar/live";
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
                summary: "Aerobic work",
                coachingNotes: null,
                estimatedDurationSeconds: 1800,
                estimatedDistanceMeters: 5000,
                intervalBlocks: [],
              },
            };
          }

          if (index === 1) {
            return {
              date: isoDate,
              session: {
                sessionType: "workout",
                title: "Tempo session",
                summary: "Threshold reps",
                coachingNotes: null,
                estimatedDurationSeconds: 2400,
                estimatedDistanceMeters: 7000,
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
                summary: "Steady aerobic volume",
                coachingNotes: null,
                estimatedDurationSeconds: 4200,
                estimatedDistanceMeters: 14000,
                intervalBlocks: [],
              },
            };
          }

          return { date: isoDate, session: null };
        }),
      }),
  };
}

async function seedTrainingCalendarUser(overrides?: {
  email?: string;
  name?: string;
  activityPrefix?: string;
}) {
  const { db } = await getIntegrationHarness();
  const user = await createUser(db, {
    email: overrides?.email ?? "calendar-planner@example.com",
    name: overrides?.name ?? "Calendar Planner",
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
      intervalsUsername: `${user.id}@example.com`,
      intervalsApiKey: "secret-key",
    }),
  );

  const prefix = overrides?.activityPrefix ?? "run";
  await db.insert(importedActivity).values([
    {
      userId: user.id,
      upstreamActivityId: `${prefix}-1`,
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Monday completion",
      startAt: new Date("2026-04-06T06:00:00.000Z"),
      movingTimeSeconds: 1790,
      elapsedTimeSeconds: 1800,
      distanceMeters: 5000,
      totalElevationGainMeters: 20,
      averageSpeedMetersPerSecond: 2.7,
      averageHeartrate: 148,
      trainingLoad: 40,
      rawDetail: { id: `${prefix}-1` },
    },
    {
      userId: user.id,
      upstreamActivityId: `${prefix}-2`,
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Tuesday completion",
      startAt: new Date("2026-04-07T06:00:00.000Z"),
      movingTimeSeconds: 2390,
      elapsedTimeSeconds: 2400,
      distanceMeters: 7000,
      totalElevationGainMeters: 35,
      averageSpeedMetersPerSecond: 2.9,
      averageHeartrate: 155,
      trainingLoad: 60,
      rawDetail: { id: `${prefix}-2` },
    },
    {
      userId: user.id,
      upstreamActivityId: `${prefix}-3`,
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Wednesday run",
      startAt: new Date("2026-04-08T06:00:00.000Z"),
      movingTimeSeconds: 1500,
      elapsedTimeSeconds: 1500,
      distanceMeters: 4000,
      totalElevationGainMeters: 12,
      averageSpeedMetersPerSecond: 2.6,
      averageHeartrate: 144,
      trainingLoad: 28,
      rawDetail: { id: `${prefix}-3` },
    },
  ]);

  const weeklyPlanningService = createWeeklyPlanningService({
    trainingSettingsService: createLiveTrainingSettingsService({ db }),
    planningDataService: createLivePlanningDataService({ db }),
    repo: createWeeklyPlanningRepository(db),
    model: createFakeModel(),
    clock: { now: () => new Date("2026-04-01T00:00:00.000Z") },
    idGenerator: (() => {
      let index = 0;
      return () => `calendar-plan-${user.id}-${++index}`;
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

  return {
    db,
    user,
    draft,
    weeklyPlanningService,
    service: createLiveTrainingCalendarService({ db }),
    activities: {
      monday: `${prefix}-1`,
      tuesday: `${prefix}-2`,
      wednesday: `${prefix}-3`,
    },
  };
}

async function expectLinkActivityError(
  run: Promise<unknown>,
  expectedMessage: string,
) {
  try {
    await run;
    throw new Error("Expected linkActivity to reject");
  } catch (error) {
    expect(error).toMatchObject({
      message: expectedMessage,
    });
  }
}

describe("training calendar integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("returns actual activities, active draft sessions, and suppresses linked standalone duplicates", async () => {
    const { db, user, draft, service, activities } =
      await seedTrainingCalendarUser();

    await db.insert(weeklyPlanActivityLink).values({
      userId: user.id,
      weeklyPlanId: draft.id,
      plannedDate: "2026-04-06",
      activityId: activities.monday,
    });

    const result = await Effect.runPromise(
      service.month(user.id, {
        from: "2026-04-06T00:00:00.000Z",
        to: "2026-04-13T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      }),
    );

    expect(result.activities.map((activity) => activity.id)).toEqual([
      activities.tuesday,
      activities.wednesday,
    ]);
    expect(result.plannedSessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-04-06",
          status: "completed",
          linkedActivity: expect.objectContaining({
            id: activities.monday,
          }),
        }),
        expect.objectContaining({
          date: "2026-04-07",
          status: "planned",
          candidateActivities: [
            expect.objectContaining({
              id: activities.tuesday,
            }),
          ],
        }),
      ]),
    );
    expect(result.weeks[0]).toEqual({
      weekStart: "2026-04-06",
      weekEnd: "2026-04-12",
      time: 5700,
      distance: 16000,
      totalElevationGain: 67,
      averagePaceSecondsPerKm: 356.25,
    });
  });

  it("persists a same-date activity link and exposes the linked session as completed", async () => {
    const { db, user, service, activities } = await seedTrainingCalendarUser({
      email: "calendar-link@example.com",
      name: "Calendar Link",
      activityPrefix: "link",
    });

    const result = await Effect.runPromise(
      service.linkActivity(user.id, {
        plannedDate: "2026-04-06",
        activityId: activities.monday,
        timezone: "Australia/Brisbane",
      }),
    );

    expect(result).toEqual({
      plannedDate: "2026-04-06",
      activityId: activities.monday,
    });

    const storedLink = await db.query.weeklyPlanActivityLink.findFirst({
      where: (table, { eq }) => eq(table.userId, user.id),
    });

    expect(storedLink).toMatchObject({
      plannedDate: "2026-04-06",
      activityId: activities.monday,
    });

    const month = await Effect.runPromise(
      service.month(user.id, {
        from: "2026-04-06T00:00:00.000Z",
        to: "2026-04-13T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      }),
    );

    expect(month.plannedSessions[0]).toEqual(
      expect.objectContaining({
        date: "2026-04-06",
        status: "completed",
        linkedActivity: expect.objectContaining({
          id: activities.monday,
        }),
      }),
    );
  });

  it("rejects missing-session, wrong-date, cross-user, and duplicate planned-session links", async () => {
    const primary = await seedTrainingCalendarUser({
      email: "calendar-invalid@example.com",
      name: "Calendar Invalid",
      activityPrefix: "primary",
    });
    const secondary = await seedTrainingCalendarUser({
      email: "calendar-other@example.com",
      name: "Calendar Other",
      activityPrefix: "secondary",
    });

    await expectLinkActivityError(
      Effect.runPromise(
        primary.service.linkActivity(primary.user.id, {
          plannedDate: "2026-04-08",
          activityId: primary.activities.wednesday,
          timezone: "Australia/Brisbane",
        }),
      ),
      "Selected planned day does not have a scheduled session",
    );

    await expectLinkActivityError(
      Effect.runPromise(
        primary.service.linkActivity(primary.user.id, {
          plannedDate: "2026-04-06",
          activityId: primary.activities.wednesday,
          timezone: "Australia/Brisbane",
        }),
      ),
      "Selected activity must occur on the same local calendar date as the planned session",
    );

    await expectLinkActivityError(
      Effect.runPromise(
        primary.service.linkActivity(primary.user.id, {
          plannedDate: "2026-04-06",
          activityId: secondary.activities.monday,
          timezone: "Australia/Brisbane",
        }),
      ),
      "Selected activity does not exist for this user",
    );

    await Effect.runPromise(
      primary.service.linkActivity(primary.user.id, {
        plannedDate: "2026-04-06",
        activityId: primary.activities.monday,
        timezone: "Australia/Brisbane",
      }),
    );

    await expectLinkActivityError(
      Effect.runPromise(
        primary.service.linkActivity(primary.user.id, {
          plannedDate: "2026-04-06",
          activityId: primary.activities.monday,
          timezone: "Australia/Brisbane",
        }),
      ),
      "This planned session is already linked to an activity",
    );
  });

  it("renders the plan whose dates overlap the viewed week when multiple drafts exist", async () => {
    const seeded = await seedTrainingCalendarUser({
      email: "calendar-multi-week@example.com",
      name: "Calendar Multi Week",
      activityPrefix: "multi",
    });

    await seeded.db.insert(importedActivity).values({
      userId: seeded.user.id,
      upstreamActivityId: "multi-4",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Second week Monday run",
      startAt: new Date("2026-04-13T06:00:00.000Z"),
      movingTimeSeconds: 1800,
      elapsedTimeSeconds: 1800,
      distanceMeters: 5000,
      totalElevationGainMeters: 24,
      averageSpeedMetersPerSecond: 2.7,
      averageHeartrate: 149,
      trainingLoad: 42,
      rawDetail: { id: "multi-4" },
    });

    const nextDraft = await Effect.runPromise(
      seeded.weeklyPlanningService.generateNextWeek(seeded.user.id),
    );

    const firstWeek = await Effect.runPromise(
      seeded.service.month(seeded.user.id, {
        from: "2026-04-06T00:00:00.000Z",
        to: "2026-04-12T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      }),
    );
    const secondWeek = await Effect.runPromise(
      seeded.service.month(seeded.user.id, {
        from: "2026-04-13T00:00:00.000Z",
        to: "2026-04-19T00:00:00.000Z",
        timezone: "Australia/Brisbane",
      }),
    );

    expect(firstWeek.plannedSessions.map((session) => session.date)).toEqual([
      "2026-04-06",
      "2026-04-07",
      "2026-04-11",
    ]);
    expect(secondWeek.plannedSessions.map((session) => session.date)).toEqual([
      "2026-04-13",
      "2026-04-14",
      "2026-04-18",
    ]);
    expect(secondWeek.plannedSessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-04-13",
          status: "planned",
          candidateActivities: [
            expect.objectContaining({
              id: "multi-4",
            }),
          ],
        }),
      ]),
    );
    expect(nextDraft.startDate).toBe("2026-04-13");
  });

  it("links an activity against the plan covering the selected date when multiple drafts exist", async () => {
    const seeded = await seedTrainingCalendarUser({
      email: "calendar-next-link@example.com",
      name: "Calendar Next Link",
      activityPrefix: "nextlink",
    });

    await seeded.db.insert(importedActivity).values({
      userId: seeded.user.id,
      upstreamActivityId: "nextlink-4",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      name: "Second week Monday completion",
      startAt: new Date("2026-04-13T06:00:00.000Z"),
      movingTimeSeconds: 1800,
      elapsedTimeSeconds: 1800,
      distanceMeters: 5000,
      totalElevationGainMeters: 24,
      averageSpeedMetersPerSecond: 2.7,
      averageHeartrate: 149,
      trainingLoad: 42,
      rawDetail: { id: "nextlink-4" },
    });

    const nextDraft = await Effect.runPromise(
      seeded.weeklyPlanningService.generateNextWeek(seeded.user.id),
    );

    await Effect.runPromise(
      seeded.service.linkActivity(seeded.user.id, {
        plannedDate: "2026-04-13",
        activityId: "nextlink-4",
        timezone: "Australia/Brisbane",
      }),
    );

    const storedLink = await seeded.db.query.weeklyPlanActivityLink.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.userId, seeded.user.id),
          eq(table.plannedDate, "2026-04-13"),
        ),
    });

    expect(storedLink).toMatchObject({
      weeklyPlanId: nextDraft.id,
      plannedDate: "2026-04-13",
      activityId: "nextlink-4",
    });
  });
});
