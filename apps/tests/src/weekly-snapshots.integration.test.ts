import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import { createWeeklySnapshotRepository } from "@corex/api/weekly-snapshots/repository";
import { createWeeklySnapshotService } from "@corex/api/weekly-snapshots/service";
import type { WeeklyWrappedData } from "@corex/api/weekly-snapshots/contracts";

import { getIntegrationHarness, resetDatabase } from "./harness";

function buildPayload(distanceMeters: number): WeeklyWrappedData {
  return {
    shouldShow: true,
    generatedAt: "2026-04-06T01:00:00.000Z",
    period: {
      weekStart: "2026-03-29T14:00:00.000Z",
      weekEnd: "2026-04-05T14:00:00.000Z",
      timezone: "Australia/Brisbane",
    },
    totals: {
      distanceMeters,
      runCount: 3,
      elapsedTimeSeconds: 12000,
      movingTimeSeconds: 11800,
      avgPaceSecPerKm: 354,
    },
    comparisonVsPriorWeek: {
      distanceMetersDelta: 4000,
      runCountDelta: 1,
      avgPaceSecPerKmDelta: -12,
    },
    goals: [],
    highlights: {
      bestDistanceDayMeters: distanceMeters,
      longestRunMeters: 18000,
      fastestRunPaceSecPerKm: 330,
    },
  };
}

describe("weekly snapshot repository integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("upserts and finds a snapshot by user, week, and timezone", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "snapshot-find@example.com",
      name: "Snapshot Find",
    });
    const repo = createWeeklySnapshotRepository(db);

    const created = await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-1",
        userId: user.id,
        timezone: "Australia/Brisbane",
        weekStart: new Date("2026-03-29T14:00:00.000Z"),
        weekEnd: new Date("2026-04-05T14:00:00.000Z"),
        generatedAt: new Date("2026-04-06T01:00:00.000Z"),
        sourceSyncCompletedAt: new Date("2026-04-05T03:00:00.000Z"),
        payload: buildPayload(42000),
      }),
    );

    const found = await Effect.runPromise(
      repo.findByUserAndWeek({
        userId: user.id,
        timezone: "Australia/Brisbane",
        weekStart: new Date("2026-03-29T14:00:00.000Z"),
        weekEnd: new Date("2026-04-05T14:00:00.000Z"),
      }),
    );

    expect(found).toEqual(created);
    expect(found?.payload.totals?.distanceMeters).toBe(42000);
  });

  it("keeps a single row for the same user/week/timezone and updates the payload", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "snapshot-upsert@example.com",
      name: "Snapshot Upsert",
    });
    const repo = createWeeklySnapshotRepository(db);

    const first = await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-2",
        userId: user.id,
        timezone: "Australia/Brisbane",
        weekStart: new Date("2026-03-29T14:00:00.000Z"),
        weekEnd: new Date("2026-04-05T14:00:00.000Z"),
        generatedAt: new Date("2026-04-06T01:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(42000),
      }),
    );

    const second = await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-3",
        userId: user.id,
        timezone: "Australia/Brisbane",
        weekStart: new Date("2026-03-29T14:00:00.000Z"),
        weekEnd: new Date("2026-04-05T14:00:00.000Z"),
        generatedAt: new Date("2026-04-06T02:00:00.000Z"),
        sourceSyncCompletedAt: new Date("2026-04-05T04:00:00.000Z"),
        payload: buildPayload(46000),
      }),
    );

    const rows = await db.query.weeklySnapshot.findMany();

    expect(rows).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(second.generatedAt).toEqual(new Date("2026-04-06T02:00:00.000Z"));
    expect(second.payload.totals?.distanceMeters).toBe(46000);
  });

  it("returns the latest snapshot for a user", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "snapshot-latest@example.com",
      name: "Snapshot Latest",
    });
    const repo = createWeeklySnapshotRepository(db);

    await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-4",
        userId: user.id,
        timezone: "UTC",
        weekStart: new Date("2026-03-23T00:00:00.000Z"),
        weekEnd: new Date("2026-03-30T00:00:00.000Z"),
        generatedAt: new Date("2026-03-30T01:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(30000),
      }),
    );
    await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-5",
        userId: user.id,
        timezone: "UTC",
        weekStart: new Date("2026-03-30T00:00:00.000Z"),
        weekEnd: new Date("2026-04-06T00:00:00.000Z"),
        generatedAt: new Date("2026-04-06T01:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(42000),
      }),
    );

    const latest = await Effect.runPromise(repo.getLatestForUser(user.id));

    expect(latest?.weekStart).toEqual(new Date("2026-03-30T00:00:00.000Z"));
    expect(latest?.payload.totals?.distanceMeters).toBe(42000);
  });

  it("lists snapshot summaries for one user in newest-first order", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "snapshot-list@example.com",
      name: "Snapshot List",
    });
    const otherUser = await createUser(db, {
      email: "snapshot-list-other@example.com",
      name: "Snapshot List Other",
    });
    const repo = createWeeklySnapshotRepository(db);

    await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-list-old",
        userId: user.id,
        timezone: "UTC",
        weekStart: new Date("2026-03-23T00:00:00.000Z"),
        weekEnd: new Date("2026-03-30T00:00:00.000Z"),
        generatedAt: new Date("2026-03-30T01:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(21000),
      }),
    );
    await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-list-current-first",
        userId: user.id,
        timezone: "UTC",
        weekStart: new Date("2026-03-30T00:00:00.000Z"),
        weekEnd: new Date("2026-04-06T00:00:00.000Z"),
        generatedAt: new Date("2026-04-06T01:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(36000),
      }),
    );
    await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-list-current-second",
        userId: user.id,
        timezone: "Australia/Brisbane",
        weekStart: new Date("2026-03-30T00:00:00.000Z"),
        weekEnd: new Date("2026-04-06T00:00:00.000Z"),
        generatedAt: new Date("2026-04-06T02:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(42000),
      }),
    );
    await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-list-other-user",
        userId: otherUser.id,
        timezone: "UTC",
        weekStart: new Date("2026-04-06T00:00:00.000Z"),
        weekEnd: new Date("2026-04-13T00:00:00.000Z"),
        generatedAt: new Date("2026-04-13T01:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(99000),
      }),
    );

    const summaries = await Effect.runPromise(repo.listForUser(user.id));

    expect(summaries).toEqual([
      {
        weekStart: "2026-03-30T00:00:00.000Z",
        weekEnd: "2026-04-06T00:00:00.000Z",
        timezone: "Australia/Brisbane",
        generatedAt: "2026-04-06T02:00:00.000Z",
        totals: buildPayload(42000).totals,
      },
      {
        weekStart: "2026-03-30T00:00:00.000Z",
        weekEnd: "2026-04-06T00:00:00.000Z",
        timezone: "UTC",
        generatedAt: "2026-04-06T01:00:00.000Z",
        totals: buildPayload(36000).totals,
      },
      {
        weekStart: "2026-03-23T00:00:00.000Z",
        weekEnd: "2026-03-30T00:00:00.000Z",
        timezone: "UTC",
        generatedAt: "2026-03-30T01:00:00.000Z",
        totals: buildPayload(21000).totals,
      },
    ]);
  });

  it("finds a selected week using the persisted timezone and does not expose other users", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "snapshot-selected@example.com",
      name: "Snapshot Selected",
    });
    const otherUser = await createUser(db, {
      email: "snapshot-selected-other@example.com",
      name: "Snapshot Selected Other",
    });
    const repo = createWeeklySnapshotRepository(db);
    const weekStart = new Date("2026-03-30T00:00:00.000Z");
    const weekEnd = new Date("2026-04-06T00:00:00.000Z");

    await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-selected-brisbane",
        userId: user.id,
        timezone: "Australia/Brisbane",
        weekStart,
        weekEnd,
        generatedAt: new Date("2026-04-06T01:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(42000),
      }),
    );
    await Effect.runPromise(
      repo.upsertForUserAndWeek({
        id: "snapshot-selected-other",
        userId: otherUser.id,
        timezone: "Pacific/Auckland",
        weekStart,
        weekEnd,
        generatedAt: new Date("2026-04-06T01:00:00.000Z"),
        sourceSyncCompletedAt: null,
        payload: buildPayload(99000),
      }),
    );

    const service = createWeeklySnapshotService({
      snapshotRepo: repo,
      trainingSettingsService: {
        getTimezoneForUser: () => Effect.succeed("Pacific/Auckland"),
      },
      planningRepo: {
        getHistoryRuns: () => Effect.succeed([]),
        getLatestSuccessfulSync: () => Effect.succeed(null),
      },
      createGoalProgressServiceAt: () => ({
        getForUser: () => Effect.die("not used"),
      }),
    });
    const selected = await Effect.runPromise(
      service.getByWeekForUser({
        userId: user.id,
        timezone: "Australia/Brisbane",
        weekStart,
        weekEnd,
      }),
    );
    const currentTimezoneSelection = await Effect.runPromise(
      service.getByWeekForUser({
        userId: user.id,
        timezone: "Pacific/Auckland",
        weekStart,
        weekEnd,
      }),
    );

    expect(selected?.payload.totals?.distanceMeters).toBe(42000);
    expect(currentTimezoneSelection).toBeNull();
  });
});
