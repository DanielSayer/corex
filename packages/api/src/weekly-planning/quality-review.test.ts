import { describe, expect, it } from "bun:test";

import {
  DAYS_OF_WEEK,
  SESSION_TYPES,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
  type DraftGenerationContext,
  type PlannedSession,
  type WeeklyPlanPayload,
} from "./contracts";
import { aggregateTerrainSummary } from "../terrain/domain";
import { reviewPlanQuality } from "./quality-review";

function createContext(
  overrides: Partial<DraftGenerationContext> = {},
): DraftGenerationContext {
  return {
    plannerIntent: {
      planGoal: TRAINING_PLAN_GOALS.generalTraining,
    },
    generationMode: "initial",
    parentWeeklyPlanId: null,
    previousPlanWindow: null,
    priorPlanAdherence: null,
    currentDate: "2026-04-01",
    currentDayOfWeek: DAYS_OF_WEEK.wednesday,
    availability: {
      monday: { available: true, maxDurationMinutes: 60 },
      tuesday: { available: true, maxDurationMinutes: 60 },
      wednesday: { available: true, maxDurationMinutes: 60 },
      thursday: { available: true, maxDurationMinutes: 60 },
      friday: { available: true, maxDurationMinutes: 60 },
      saturday: { available: true, maxDurationMinutes: 120 },
      sunday: { available: true, maxDurationMinutes: 60 },
    },
    historySnapshot: {
      generatedAt: "2026-04-01T00:00:00.000Z",
      detailedRuns: [],
      weeklyRollups: [
        {
          weekStart: "2026-03-16",
          weekEnd: "2026-03-22",
          runCount: 3,
          totalDistanceMeters: 30000,
          totalDurationSeconds: 10800,
          longestRunDistanceMeters: 12000,
          totalElevationGainMeters: 100,
          heartRateZoneTimes: {
            z1Seconds: 0,
            z2Seconds: 9000,
            z3Seconds: 1800,
            z4Seconds: 0,
            z5Seconds: 0,
          },
        },
        {
          weekStart: "2026-03-23",
          weekEnd: "2026-03-29",
          runCount: 3,
          totalDistanceMeters: 32000,
          totalDurationSeconds: 11400,
          longestRunDistanceMeters: 13000,
          totalElevationGainMeters: 120,
          heartRateZoneTimes: {
            z1Seconds: 0,
            z2Seconds: 9600,
            z3Seconds: 1800,
            z4Seconds: 0,
            z5Seconds: 0,
          },
        },
      ],
      terrainSummary: aggregateTerrainSummary([]),
    },
    historyQuality: {
      hasAnyHistory: true,
      meetsSnapshotThreshold: true,
      hasRecentSync: true,
      latestSyncWarnings: [],
      availableDateRange: {
        start: "2026-03-16T00:00:00.000Z",
        end: "2026-03-29T00:00:00.000Z",
      },
    },
    performanceSnapshot: {
      allTimePrs: [],
      recentPrs: [],
      processingWarnings: [],
    },
    userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
    corexPerceivedAbility: {
      level: "intermediate",
      rationale: "Stable recent history.",
    },
    longRunDay: DAYS_OF_WEEK.saturday,
    startDate: "2026-04-06",
    startDateDayOfWeek: DAYS_OF_WEEK.monday,
    endDate: "2026-04-12",
    planDurationWeeks: 4,
    ...overrides,
  };
}

function session(input: {
  sessionType: "easy_run" | "long_run" | "workout";
  durationSeconds: number;
  distanceMeters: number | null;
  rpe?: number;
}): PlannedSession {
  return {
    sessionType: input.sessionType,
    title: "Run",
    summary: "Run",
    coachingNotes: null,
    estimatedDurationSeconds: input.durationSeconds,
    estimatedDistanceMeters: input.distanceMeters,
    intervalBlocks: [
      {
        blockType: "steady",
        order: 1,
        repetitions: 1,
        title: "Steady",
        notes: null,
        target: {
          durationSeconds: input.durationSeconds,
          distanceMeters: null,
          pace: null,
          heartRate: "Z2",
          rpe: input.rpe ?? 4,
        },
      },
    ],
  };
}

function createPayload(
  overrides: Partial<WeeklyPlanPayload> = {},
): WeeklyPlanPayload {
  return {
    days: [
      {
        date: "2026-04-06",
        session: session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 1800,
          distanceMeters: 5000,
        }),
      },
      { date: "2026-04-07", session: null },
      {
        date: "2026-04-08",
        session: session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 2100,
          distanceMeters: 6000,
        }),
      },
      { date: "2026-04-09", session: null },
      {
        date: "2026-04-10",
        session: session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 1800,
          distanceMeters: 5000,
        }),
      },
      {
        date: "2026-04-11",
        session: session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 2800,
          distanceMeters: 8000,
        }),
      },
      { date: "2026-04-12", session: null },
    ],
    ...overrides,
  };
}

function withSessions(
  sessions: Array<PlannedSession | null>,
): WeeklyPlanPayload {
  return {
    days: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-04-${String(index + 6).padStart(2, "0")}`,
      session: sessions[index] ?? null,
    })),
  };
}

describe("weekly plan quality review", () => {
  it("passes an acceptable plan close to recent training load", () => {
    const report = reviewPlanQuality({
      payload: createPayload(),
      generationContext: createContext(),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report).toMatchObject({
      status: "pass",
      mode: "enforced",
      items: [],
    });
  });

  it("blocks excessive weekly distance in enforced mode", () => {
    const report = reviewPlanQuality({
      payload: withSessions([
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: 12000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: 12000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: 12000,
        }),
        session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 4200,
          distanceMeters: 14000,
        }),
        null,
      ]),
      generationContext: createContext(),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("blocked");
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "weekly_distance_blocking",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("blocks excessive weekly duration in enforced mode when distance is unavailable", () => {
    const report = reviewPlanQuality({
      payload: withSessions([
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 5400,
          distanceMeters: null,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 5400,
          distanceMeters: null,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: null,
        }),
        session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 4200,
          distanceMeters: null,
        }),
        null,
      ]),
      generationContext: createContext(),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("blocked");
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "weekly_duration_blocking",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("blocks excessive long-run share", () => {
    const report = reviewPlanQuality({
      payload: withSessions([
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 1800,
          distanceMeters: 4000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 1800,
          distanceMeters: 4000,
        }),
        null,
        null,
        session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 4500,
          distanceMeters: 12000,
        }),
        null,
      ]),
      generationContext: createContext(),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("blocked");
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "long_run_distance_share_blocking",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("blocks excessive long-run distance jumps", () => {
    const report = reviewPlanQuality({
      payload: withSessions([
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: 12000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: 12000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: 12000,
        }),
        session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 5400,
          distanceMeters: 20000,
        }),
        null,
      ]),
      generationContext: createContext(),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("blocked");
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "long_run_distance_jump_blocking",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("blocks too many hard sessions", () => {
    const report = reviewPlanQuality({
      payload: withSessions([
        session({
          sessionType: SESSION_TYPES.workout,
          durationSeconds: 1800,
          distanceMeters: 5000,
          rpe: 7,
        }),
        session({
          sessionType: SESSION_TYPES.workout,
          durationSeconds: 1800,
          distanceMeters: 5000,
          rpe: 7,
        }),
        session({
          sessionType: SESSION_TYPES.workout,
          durationSeconds: 1800,
          distanceMeters: 5000,
          rpe: 7,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.workout,
          durationSeconds: 1800,
          distanceMeters: 5000,
          rpe: 7,
        }),
        session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 2800,
          distanceMeters: 8000,
        }),
        null,
      ]),
      generationContext: createContext(),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("blocked");
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "hard_session_count_blocking",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("uses stricter thresholds in low-history mode", () => {
    const report = reviewPlanQuality({
      payload: withSessions([
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3000,
          distanceMeters: 9000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3000,
          distanceMeters: 9000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3000,
          distanceMeters: 9000,
        }),
        session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 4200,
          distanceMeters: 12000,
        }),
        null,
      ]),
      generationContext: createContext({
        historyQuality: {
          hasAnyHistory: true,
          meetsSnapshotThreshold: false,
          hasRecentSync: true,
          latestSyncWarnings: [],
          availableDateRange: {
            start: "2026-03-16T00:00:00.000Z",
            end: "2026-03-29T00:00:00.000Z",
          },
        },
      }),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("warning");
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "weekly_distance_warning",
          severity: "warning",
        }),
      ]),
    );
  });

  it("returns warning for borderline load increases", () => {
    const report = reviewPlanQuality({
      payload: withSessions([
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3000,
          distanceMeters: 9000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3000,
          distanceMeters: 9000,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3000,
          distanceMeters: 9000,
        }),
        session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 3600,
          distanceMeters: 12000,
        }),
        null,
      ]),
      generationContext: createContext(),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("warning");
    expect(report.items.every((item) => item.severity === "warning")).toBe(
      true,
    );
  });

  it("handles missing distance estimates and still checks duration", () => {
    const report = reviewPlanQuality({
      payload: withSessions([
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: null,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: null,
        }),
        null,
        session({
          sessionType: SESSION_TYPES.easyRun,
          durationSeconds: 3600,
          distanceMeters: null,
        }),
        session({
          sessionType: SESSION_TYPES.longRun,
          durationSeconds: 3600,
          distanceMeters: null,
        }),
        null,
      ]),
      generationContext: createContext(),
      mode: "enforced",
      generatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(report.status).toBe("warning");
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "weekly_duration_warning",
          severity: "warning",
        }),
      ]),
    );
  });
});
