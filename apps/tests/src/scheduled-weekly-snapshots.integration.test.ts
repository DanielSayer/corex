import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createGoalRepository } from "@corex/api/goals/repository";
import { createGoalsApi } from "@corex/api/goals/service";
import { createCredentialCrypto } from "@corex/api/training-settings/crypto";
import { createTrainingSettingsRepository } from "@corex/api/training-settings/repository";
import { createTrainingSettingsService } from "@corex/api/training-settings/service";
import { runScheduledWeeklySnapshotGeneration } from "@corex/api/weekly-snapshots/scheduled";
import type { TrainingGoal } from "@corex/api/training-settings/contracts";
import { importedActivity, syncEvent } from "@corex/db/schema/intervals-sync";
import { trainingGoal } from "@corex/db/schema/training-settings";

import { getIntegrationHarness, resetDatabase } from "./harness";

const masterKeyBase64 = Buffer.alloc(32, 9).toString("base64");

async function saveTrainingSettings(input: {
  userId: string;
  timezone: string;
  goal: TrainingGoal;
}) {
  const { db } = await getIntegrationHarness();
  const trainingRepo = createTrainingSettingsRepository(db);
  const service = createTrainingSettingsService({
    repo: trainingRepo,
    crypto: createCredentialCrypto({
      masterKeyBase64,
      keyVersion: 1,
    }),
  });

  await Effect.runPromise(
    service.upsertForUser(input.userId, {
      availability: {
        monday: { available: true, maxDurationMinutes: 45 },
        tuesday: { available: true, maxDurationMinutes: 45 },
        wednesday: { available: true, maxDurationMinutes: 45 },
        thursday: { available: true, maxDurationMinutes: 45 },
        friday: { available: true, maxDurationMinutes: 45 },
        saturday: { available: true, maxDurationMinutes: 90 },
        sunday: { available: false, maxDurationMinutes: null },
      },
      intervalsUsername: `${input.userId}@example.com`,
      intervalsApiKey: "intervals-secret-key",
      timezone: input.timezone,
    }),
  );

  await Effect.runPromise(
    createGoalsApi({
      repo: createGoalRepository(db),
      trainingSettingsRepo: trainingRepo,
      clock: { now: () => new Date("2026-04-13T01:00:00.000Z") },
    }).createForUser(input.userId, input.goal),
  );
}

async function insertSuccessfulSync(userId: string, completedAt: string) {
  const { db } = await getIntegrationHarness();

  await db.insert(syncEvent).values({
    id: `sync-${userId}-${completedAt}`,
    userId,
    status: "success",
    startedAt: new Date(completedAt),
    completedAt: new Date(completedAt),
    unknownActivityTypes: [],
    warnings: [],
    failedDetails: [],
  });
}

describe("scheduled weekly snapshot generation integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("generates a prior local-week snapshot and records job outcomes without a web request", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "scheduled-snapshot@example.com",
      name: "Scheduled Snapshot",
    });

    await saveTrainingSettings({
      userId: user.id,
      timezone: "Australia/Brisbane",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await db.insert(importedActivity).values([
      {
        userId: user.id,
        upstreamActivityId: "comparison-run",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-02T21:00:00.000Z"),
        movingTimeSeconds: 2500,
        elapsedTimeSeconds: 2550,
        distanceMeters: 8000,
        rawDetail: {},
      },
      {
        userId: user.id,
        upstreamActivityId: "target-run",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-11T21:00:00.000Z"),
        movingTimeSeconds: 5400,
        elapsedTimeSeconds: 5550,
        distanceMeters: 18000,
        rawDetail: {},
      },
    ]);
    await insertSuccessfulSync(user.id, "2026-04-13T00:30:00.000Z");

    const result = await Effect.runPromise(
      runScheduledWeeklySnapshotGeneration({
        db,
        now: new Date("2026-04-13T01:00:00.000Z"),
      }),
    );

    const snapshots = await db.query.weeklySnapshot.findMany();
    const runs = await db.query.weeklySnapshotJobRun.findMany();
    const attempts = await db.query.weeklySnapshotJobAttempt.findMany();

    expect(result).toMatchObject({
      status: "success",
      generatedCount: 1,
      existingCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      userId: user.id,
      timezone: "Australia/Brisbane",
      weekStart: new Date("2026-04-05T14:00:00.000Z"),
      weekEnd: new Date("2026-04-12T14:00:00.000Z"),
      generatedAt: new Date("2026-04-13T01:00:00.000Z"),
    });
    expect(snapshots[0]?.payload).toMatchObject({
      totals: {
        distanceMeters: 18000,
        runCount: 1,
      },
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
      weekStart: new Date("2026-04-05T14:00:00.000Z"),
      weekEnd: new Date("2026-04-12T14:00:00.000Z"),
      status: "generated",
      snapshotId: snapshots[0]?.id,
      failureSummary: null,
    });
  });

  it("records existing on rerun and does not overwrite the frozen snapshot", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "scheduled-snapshot-existing@example.com",
      name: "Scheduled Snapshot Existing",
    });

    await saveTrainingSettings({
      userId: user.id,
      timezone: "Australia/Brisbane",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "target-run-existing",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-04-11T21:00:00.000Z"),
      movingTimeSeconds: 5400,
      elapsedTimeSeconds: 5550,
      distanceMeters: 18000,
      rawDetail: {},
    });
    await insertSuccessfulSync(user.id, "2026-04-13T00:30:00.000Z");

    await Effect.runPromise(
      runScheduledWeeklySnapshotGeneration({
        db,
        now: new Date("2026-04-13T01:00:00.000Z"),
      }),
    );
    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "late-target-run-existing",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-04-10T21:00:00.000Z"),
      movingTimeSeconds: 3000,
      elapsedTimeSeconds: 3050,
      distanceMeters: 10000,
      rawDetail: {},
    });

    const result = await Effect.runPromise(
      runScheduledWeeklySnapshotGeneration({
        db,
        now: new Date("2026-04-16T01:00:00.000Z"),
      }),
    );

    const snapshots = await db.query.weeklySnapshot.findMany();
    const attempts = await db.query.weeklySnapshotJobAttempt.findMany({
      orderBy: (attempt, { asc }) => [asc(attempt.createdAt)],
    });

    expect(result).toMatchObject({
      status: "success",
      generatedCount: 0,
      existingCount: 1,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      generatedAt: new Date("2026-04-13T01:00:00.000Z"),
    });
    expect(snapshots[0]?.payload).toMatchObject({
      totals: {
        distanceMeters: 18000,
        runCount: 1,
      },
    });
    expect(attempts.map((attempt) => attempt.status)).toEqual([
      "generated",
      "existing",
    ]);
  });

  it("uses each user's timezone when selecting the prior local week", async () => {
    const { db } = await getIntegrationHarness();
    const brisbaneUser = await createUser(db, {
      email: "scheduled-snapshot-brisbane@example.com",
      name: "Scheduled Snapshot Brisbane",
    });
    const losAngelesUser = await createUser(db, {
      email: "scheduled-snapshot-la@example.com",
      name: "Scheduled Snapshot LA",
    });

    await saveTrainingSettings({
      userId: brisbaneUser.id,
      timezone: "Australia/Brisbane",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await saveTrainingSettings({
      userId: losAngelesUser.id,
      timezone: "America/Los_Angeles",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await db.insert(importedActivity).values([
      {
        userId: brisbaneUser.id,
        upstreamActivityId: "target-run-brisbane",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-11T21:00:00.000Z"),
        movingTimeSeconds: 5400,
        elapsedTimeSeconds: 5550,
        distanceMeters: 18000,
        rawDetail: {},
      },
      {
        userId: losAngelesUser.id,
        upstreamActivityId: "target-run-la",
        athleteId: "athlete-2",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-10T15:00:00.000Z"),
        movingTimeSeconds: 5400,
        elapsedTimeSeconds: 5550,
        distanceMeters: 18000,
        rawDetail: {},
      },
    ]);
    await insertSuccessfulSync(brisbaneUser.id, "2026-04-13T00:30:00.000Z");
    await insertSuccessfulSync(losAngelesUser.id, "2026-04-13T08:30:00.000Z");

    const result = await Effect.runPromise(
      runScheduledWeeklySnapshotGeneration({
        db,
        now: new Date("2026-04-13T18:00:00.000Z"),
      }),
    );

    const snapshots = await db.query.weeklySnapshot.findMany({
      orderBy: (snapshot, { asc }) => [asc(snapshot.timezone)],
    });

    expect(result).toMatchObject({
      generatedCount: 2,
      failedCount: 0,
    });
    expect(snapshots).toHaveLength(2);
    expect(
      snapshots.map((snapshot) => ({
        timezone: snapshot.timezone,
        weekStart: snapshot.weekStart,
        weekEnd: snapshot.weekEnd,
      })),
    ).toEqual([
      {
        timezone: "America/Los_Angeles",
        weekStart: new Date("2026-04-06T07:00:00.000Z"),
        weekEnd: new Date("2026-04-13T07:00:00.000Z"),
      },
      {
        timezone: "Australia/Brisbane",
        weekStart: new Date("2026-04-05T14:00:00.000Z"),
        weekEnd: new Date("2026-04-12T14:00:00.000Z"),
      },
    ]);
  });

  it("skips complete users that have no relevant target or comparison week runs", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "scheduled-snapshot-skipped@example.com",
      name: "Scheduled Snapshot Skipped",
    });

    await saveTrainingSettings({
      userId: user.id,
      timezone: "Australia/Brisbane",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await db.insert(importedActivity).values({
      userId: user.id,
      upstreamActivityId: "old-run",
      athleteId: "athlete-1",
      upstreamActivityType: "Run",
      normalizedActivityType: "Run",
      startAt: new Date("2026-03-20T21:00:00.000Z"),
      movingTimeSeconds: 5400,
      elapsedTimeSeconds: 5550,
      distanceMeters: 18000,
      rawDetail: {},
    });

    const result = await Effect.runPromise(
      runScheduledWeeklySnapshotGeneration({
        db,
        now: new Date("2026-04-13T01:00:00.000Z"),
      }),
    );

    const snapshots = await db.query.weeklySnapshot.findMany();
    const attempts = await db.query.weeklySnapshotJobAttempt.findMany();

    expect(result).toMatchObject({
      status: "success",
      generatedCount: 0,
      existingCount: 0,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(snapshots).toHaveLength(0);
    expect(attempts[0]).toMatchObject({
      userId: user.id,
      status: "skipped_no_relevant_runs",
      snapshotId: null,
      failureSummary: null,
    });
  });

  it("records sanitized per-user failures and continues processing other users", async () => {
    const { db } = await getIntegrationHarness();
    const brokenUser = await createUser(db, {
      email: "scheduled-snapshot-broken@example.com",
      name: "Scheduled Snapshot Broken",
    });
    const healthyUser = await createUser(db, {
      email: "scheduled-snapshot-healthy@example.com",
      name: "Scheduled Snapshot Healthy",
    });

    await saveTrainingSettings({
      userId: brokenUser.id,
      timezone: "Australia/Brisbane",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await saveTrainingSettings({
      userId: healthyUser.id,
      timezone: "Australia/Brisbane",
      goal: {
        type: "volume_goal",
        metric: "distance",
        period: "week",
        targetValue: 40,
        unit: "km",
      },
    });
    await db.insert(trainingGoal).values({
      id: "broken-goal-with-secret",
      userId: brokenUser.id,
      goalType: "volume_goal",
      notes: "api_key=should-not-leak",
    });
    await db.insert(importedActivity).values([
      {
        userId: brokenUser.id,
        upstreamActivityId: "target-run-broken",
        athleteId: "athlete-1",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-11T21:00:00.000Z"),
        movingTimeSeconds: 5400,
        elapsedTimeSeconds: 5550,
        distanceMeters: 18000,
        rawDetail: {},
      },
      {
        userId: healthyUser.id,
        upstreamActivityId: "target-run-healthy",
        athleteId: "athlete-2",
        upstreamActivityType: "Run",
        normalizedActivityType: "Run",
        startAt: new Date("2026-04-11T21:00:00.000Z"),
        movingTimeSeconds: 5400,
        elapsedTimeSeconds: 5550,
        distanceMeters: 18000,
        rawDetail: {},
      },
    ]);

    const result = await Effect.runPromise(
      runScheduledWeeklySnapshotGeneration({
        db,
        now: new Date("2026-04-13T01:00:00.000Z"),
      }),
    );

    const snapshots = await db.query.weeklySnapshot.findMany();
    const attempts = await db.query.weeklySnapshotJobAttempt.findMany({
      orderBy: (attempt, { asc }) => [asc(attempt.status)],
    });

    expect(result).toMatchObject({
      status: "partial_failure",
      generatedCount: 1,
      failedCount: 1,
    });
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.userId).toBe(healthyUser.id);
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
      "failed",
      "generated",
    ]);
    const failedAttempt = attempts.find(
      (attempt) => attempt.status === "failed",
    );
    expect(failedAttempt).toMatchObject({
      userId: brokenUser.id,
      snapshotId: null,
    });
    expect(failedAttempt?.failureSummary).toContain("Failed to load goals");
    expect(failedAttempt?.failureSummary).not.toContain("should-not-leak");
  });
});
