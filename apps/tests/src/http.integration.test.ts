import { describe, expect, it } from "bun:test";
import { Effect } from "effect";

import { createIntervalsSyncRouter } from "@corex/api/intervals-sync/router";
import { createAppRouter } from "@corex/api/routers/index";
import { createWeeklyPlanningRouter } from "@corex/api/weekly-planning/router";

import { createHttpApp, createHttpAppWithRouter } from "./helpers/http";

describe("http integration", () => {
  it("serves the root health endpoint", async () => {
    const response = await createHttpApp(null).request("http://localhost/");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
  });

  it("rejects protected data without a session", async () => {
    const response = await createHttpApp(null).request(
      "http://localhost/trpc/privateData",
    );
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).toContain("Authentication required");
  });

  it("returns protected data when the transport receives an authenticated session", async () => {
    const response = await createHttpApp({
      session: {
        id: "session-1",
        userId: "user-1",
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      },
      user: {
        id: "user-1",
        email: "runner@example.com",
        name: "Runner One",
      },
    }).request("http://localhost/trpc/privateData");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("This is private");
    expect(body).toContain("runner@example.com");
  });

  it("rejects sync status reads without a session", async () => {
    const router = createAppRouter({
      intervalsSync: createIntervalsSyncRouter({
        service: {
          latest: () => Effect.die("not used"),
          syncNow: () => Effect.die("not used"),
        },
      }),
    });
    const response = await createHttpAppWithRouter(null, router).request(
      "http://localhost/trpc/intervalsSync.latest",
    );
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).toContain("Authentication required");
  });

  it("returns sync status when the transport receives an authenticated session", async () => {
    const router = createAppRouter({
      intervalsSync: createIntervalsSyncRouter({
        service: {
          latest: () =>
            Effect.succeed({
              eventId: "sync-1",
              status: "success",
              historyCoverage: "initial_30d_window",
              cursorStartUsed: "2026-02-20T00:00:00.000Z",
              coveredDateRange: {
                start: "2026-03-20T00:00:00.000Z",
                end: "2026-03-20T00:00:00.000Z",
              },
              newestImportedActivityStart: "2026-03-20T00:00:00.000Z",
              insertedCount: 1,
              updatedCount: 0,
              skippedNonRunningCount: 0,
              skippedInvalidCount: 0,
              failedDetailCount: 0,
              failedMapCount: 0,
              failedStreamCount: 0,
              storedMapCount: 1,
              storedStreamCount: 5,
              unknownActivityTypes: [],
              warnings: [],
              failedDetails: [],
              failureCategory: null,
              failureMessage: null,
              startedAt: "2026-03-21T00:00:00.000Z",
              completedAt: "2026-03-21T00:05:00.000Z",
            }),
          syncNow: () => Effect.die("not used"),
        },
      }),
    });
    const response = await createHttpAppWithRouter(
      {
        session: {
          id: "session-1",
          userId: "user-1",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        },
        user: {
          id: "user-1",
          email: "runner@example.com",
          name: "Runner One",
        },
      },
      router,
    ).request("http://localhost/trpc/intervalsSync.latest");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("sync-1");
    expect(body).toContain("initial_30d_window");
    expect(body).toContain("storedMapCount");
  });

  it("rejects planner state reads without a session", async () => {
    const router = createAppRouter({
      weeklyPlanning: createWeeklyPlanningRouter({
        service: {
          getState: () => Effect.die("not used"),
          generateDraft: () => Effect.die("not used"),
        },
      }),
    });
    const response = await createHttpAppWithRouter(null, router).request(
      "http://localhost/trpc/weeklyPlanning.getState",
    );
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).toContain("Authentication required");
  });

  it("returns planner state when the transport receives an authenticated session", async () => {
    const router = createAppRouter({
      weeklyPlanning: createWeeklyPlanningRouter({
        service: {
          getState: () =>
            Effect.succeed({
              goalCandidates: [],
              availability: null,
              historySnapshot: {
                generatedAt: "2026-04-01T00:00:00.000Z",
                detailedRuns: [],
                weeklyRollups: [],
              },
              historyQuality: {
                hasAnyHistory: false,
                meetsSnapshotThreshold: false,
                hasRecentSync: false,
                latestSyncWarnings: [],
                availableDateRange: {
                  start: null,
                  end: null,
                },
              },
              performanceSnapshot: {
                allTimePrs: [],
                recentPrs: [],
                processingWarnings: [],
              },
              defaults: null,
              activeDraft: null,
            }),
          generateDraft: () => Effect.die("not used"),
        },
      }),
    });
    const response = await createHttpAppWithRouter(
      {
        session: {
          id: "session-1",
          userId: "user-1",
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        },
        user: {
          id: "user-1",
          email: "runner@example.com",
          name: "Runner One",
        },
      },
      router,
    ).request("http://localhost/trpc/weeklyPlanning.getState");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("historySnapshot");
    expect(body).toContain("goalCandidates");
  });
});
