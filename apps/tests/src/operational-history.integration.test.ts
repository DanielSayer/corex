import { beforeEach, describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createUser } from "@corex/api/application/commands/create-user";
import type { IntervalsAccountPort } from "@corex/api/intervals/account";
import type { IntervalsUpstreamPort } from "@corex/api/intervals-sync/adapter";
import type { DerivedPerformancePort } from "@corex/api/intervals-sync/derived-performance-service";
import { createIntervalsSyncModule } from "@corex/api/intervals-sync/module";
import type { ImportedActivityWritePort } from "@corex/api/intervals-sync/repository";
import { createSyncLedgerPort } from "@corex/api/intervals-sync/repository";
import { createWeeklyPlanningRepository } from "@corex/api/weekly-planning/repository";
import { createWeeklyPlanningService } from "@corex/api/weekly-planning/service";
import { syncEvent } from "@corex/db/schema/intervals-sync";
import { generationEvent, weeklyPlan } from "@corex/db/schema/weekly-planning";
import type { Database } from "@corex/db";

import { getIntegrationHarness, resetDatabase } from "./harness";

function createSyncHistoryService(db: Database) {
  return createIntervalsSyncModule({
    accounts: {
      load: () => Effect.die("not used"),
      saveResolvedAthlete: () => Effect.die("not used"),
    } satisfies IntervalsAccountPort,
    upstream: {
      getProfile: async () => {
        throw new Error("not used");
      },
      listActivities: async () => {
        throw new Error("not used");
      },
      getDetail: async () => {
        throw new Error("not used");
      },
      getMap: async () => {
        throw new Error("not used");
      },
      getStreams: async () => {
        throw new Error("not used");
      },
    } satisfies IntervalsUpstreamPort,
    ledger: createSyncLedgerPort(db),
    activities: {
      upsert: () => Effect.die("not used"),
    } satisfies ImportedActivityWritePort,
    derived: {
      recompute: () => Effect.die("not used"),
    } satisfies DerivedPerformancePort,
  });
}

function createGenerationHistoryService(db: Database) {
  return createWeeklyPlanningService({
    trainingSettingsService: {
      getForUser: () => Effect.die("not used"),
      getTimezoneForUser: () => Effect.die("not used"),
    },
    planningDataService: {
      getPlanningHistorySnapshot: () => Effect.die("not used"),
      getHistoryQuality: () => Effect.die("not used"),
      getPlanningPerformanceSnapshot: () => Effect.die("not used"),
    },
    repo: createWeeklyPlanningRepository(db),
    model: {
      provider: "test",
      model: "fake-model",
      generateWeeklyPlan: () => Effect.die("not used"),
    },
  });
}

describe("operational history integration", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("lists user-scoped sync events newest first with pagination and redacted summaries", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "sync-history@example.com",
      name: "Sync History",
    });
    const otherUser = await createUser(db, {
      email: "sync-history-other@example.com",
      name: "Other Sync History",
    });

    await db.insert(syncEvent).values([
      {
        id: "sync-old",
        userId: user.id,
        status: "success",
        historyCoverage: "initial_30d_window",
        startedAt: new Date("2026-04-01T00:00:00.000Z"),
        completedAt: new Date("2026-04-01T00:01:00.000Z"),
        coveredRangeStart: new Date("2026-03-01T00:00:00.000Z"),
        coveredRangeEnd: new Date("2026-04-01T00:00:00.000Z"),
        insertedCount: 2,
        updatedCount: 1,
        skippedNonRunningCount: 1,
        skippedInvalidCount: 0,
        failedDetailCount: 0,
        failedMapCount: 1,
        failedStreamCount: 0,
        storedMapCount: 2,
        storedStreamCount: 10,
        unknownActivityTypes: ["Ride"],
        warnings: ["raw provider warning should not be returned"],
        failedDetails: [
          {
            activityId: "activity-1",
            type: "Run",
            startDate: "2026-03-01T00:00:00.000Z",
            endpoint: "map",
            message: "raw map failure should not be returned",
          },
        ],
      },
      {
        id: "sync-new",
        userId: user.id,
        status: "failure",
        historyCoverage: null,
        startedAt: new Date("2026-04-03T00:00:00.000Z"),
        completedAt: new Date("2026-04-03T00:01:00.000Z"),
        unknownActivityTypes: [],
        warnings: [],
        failedDetails: [],
        failureCategory: "upstream_request_failure",
        failureMessage:
          "Intervals API failed with api_key=super-secret-token and bearer hunter2",
      },
      {
        id: "sync-other-user",
        userId: otherUser.id,
        status: "success",
        historyCoverage: "initial_30d_window",
        startedAt: new Date("2026-04-04T00:00:00.000Z"),
        completedAt: new Date("2026-04-04T00:01:00.000Z"),
        unknownActivityTypes: [],
        warnings: [],
        failedDetails: [],
      },
    ]);

    const service = createSyncHistoryService(db);
    const firstPage = await Effect.runPromise(
      service.listEvents(user.id, { limit: 1, offset: 0 }),
    );
    const secondPage = await Effect.runPromise(
      service.listEvents(user.id, { limit: 1, offset: 1 }),
    );

    expect(firstPage.items.map((event) => event.eventId)).toEqual(["sync-new"]);
    expect(firstPage.nextOffset).toBe(1);
    expect(secondPage.items.map((event) => event.eventId)).toEqual([
      "sync-old",
    ]);
    expect(secondPage.nextOffset).toBeNull();
    expect(firstPage.items[0]?.failureSummary).toContain("[redacted]");
    expect(firstPage.items[0]?.failureSummary).not.toContain(
      "super-secret-token",
    );
    expect(secondPage.items[0]?.warningSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupported_activity_type" }),
        expect.objectContaining({ code: "map_fetch_failure" }),
      ]),
    );
    expect(JSON.stringify(secondPage.items[0])).not.toContain("failedDetails");
    expect(JSON.stringify(secondPage.items[0])).not.toContain(
      "raw provider warning",
    );
    expect(JSON.stringify(secondPage.items[0])).not.toContain(
      "raw map failure",
    );
  });

  it("lists user-scoped generation events with linked drafts and redacted model data", async () => {
    const { db } = await getIntegrationHarness();
    const user = await createUser(db, {
      email: "generation-history@example.com",
      name: "Generation History",
    });
    const otherUser = await createUser(db, {
      email: "generation-history-other@example.com",
      name: "Other Generation History",
    });

    await db.insert(weeklyPlan).values({
      id: "draft-1",
      userId: user.id,
      goalId: null,
      parentWeeklyPlanId: null,
      status: "draft",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      generationContext: {
        generationMode: "initial",
        plannerIntent: { planGoal: "general_training" },
      },
      payload: {
        days: Array.from({ length: 7 }, (_, index) => ({
          date: `2026-04-${String(index + 6).padStart(2, "0")}`,
          session: null,
        })),
      },
    });

    await db.insert(generationEvent).values([
      {
        id: "generation-old",
        userId: user.id,
        goalId: null,
        weeklyPlanId: "draft-1",
        status: "success",
        provider: "openai",
        model: "planner-model",
        startDate: "2026-04-06",
        failureCategory: null,
        failureMessage: null,
        generationContext: {
          generationMode: "initial",
          plannerIntent: { planGoal: "general_training" },
          privateUserContext: "do not expose",
        },
        modelOutput: { prompt: "do not expose model output" },
        qualityReport: {
          status: "warning",
          mode: "enforced",
          summary: "Plan generated with warnings",
          generatedAt: "2026-04-01T00:00:00.000Z",
          items: [
            {
              code: "load_jump",
              severity: "warning",
              message: "Load is increasing",
              metricValue: 1.2,
              thresholdValue: 1.1,
            },
          ],
        },
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      },
      {
        id: "generation-new",
        userId: user.id,
        goalId: null,
        weeklyPlanId: null,
        status: "failure",
        provider: "openai",
        model: "planner-model",
        startDate: "2026-04-13",
        failureCategory: "provider_failure",
        failureMessage: "provider failed with token=secret-value",
        generationContext: {
          generationMode: "regeneration",
          plannerIntent: { planGoal: "race" },
          prompt: "do not expose raw prompt",
        },
        modelOutput: { raw: "do not expose" },
        qualityReport: null,
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
      },
      {
        id: "generation-other-user",
        userId: otherUser.id,
        goalId: null,
        weeklyPlanId: null,
        status: "failure",
        provider: "openai",
        model: "planner-model",
        startDate: "2026-04-20",
        failureCategory: "provider_failure",
        failureMessage: "other user failure",
        generationContext: {
          generationMode: "initial",
          plannerIntent: { planGoal: "general_training" },
        },
        modelOutput: null,
        qualityReport: null,
      },
    ]);

    const service = createGenerationHistoryService(db);
    const result = await Effect.runPromise(
      service.listGenerationEvents(user.id, { limit: 20, offset: 0 }),
    );

    expect(result.items.map((event) => event.eventId)).toEqual([
      "generation-new",
      "generation-old",
    ]);
    expect(result.nextOffset).toBeNull();
    expect(result.items[0]).toMatchObject({
      eventId: "generation-new",
      generationMode: "regeneration",
      planGoal: "race",
      failureCategory: "provider_failure",
      failureSummary: "provider failed with token=[redacted]",
      weeklyPlanId: null,
    });
    expect(result.items[1]).toMatchObject({
      eventId: "generation-old",
      generationMode: "initial",
      planGoal: "general_training",
      weeklyPlanId: "draft-1",
      qualityReport: {
        status: "warning",
        mode: "enforced",
        summary: "Plan generated with warnings",
        warningCount: 1,
        blockingCount: 0,
      },
    });
    expect(JSON.stringify(result.items)).not.toContain("generationContext");
    expect(JSON.stringify(result.items)).not.toContain("modelOutput");
    expect(JSON.stringify(result.items)).not.toContain("do not expose");
  });
});
