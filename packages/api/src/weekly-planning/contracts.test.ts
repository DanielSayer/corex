import { describe, expect, it } from "bun:test";

import {
  COREX_PERCEIVED_ABILITY_LEVELS,
  DAYS_OF_WEEK,
  TRAINING_PLAN_GOALS,
  USER_PERCEIVED_ABILITY_LEVELS,
  weeklyPlanDraftSchema,
} from "./contracts";

describe("weekly planning contracts", () => {
  it("normalizes legacy persisted draft generation contexts", () => {
    const parsed = weeklyPlanDraftSchema.parse({
      id: "legacy-draft",
      userId: "user-1",
      goalId: null,
      parentWeeklyPlanId: null,
      status: "draft",
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      generationContext: {
        plannerIntent: {
          planGoal: TRAINING_PLAN_GOALS.generalTraining,
        },
        currentDate: "2026-04-01",
        availability: {
          monday: { available: true, maxDurationMinutes: 45 },
          tuesday: { available: true, maxDurationMinutes: 45 },
          wednesday: { available: true, maxDurationMinutes: 60 },
          thursday: { available: true, maxDurationMinutes: 45 },
          friday: { available: true, maxDurationMinutes: 90 },
          saturday: { available: true, maxDurationMinutes: 120 },
          sunday: { available: true, maxDurationMinutes: 90 },
        },
        historySnapshot: {
          generatedAt: "2026-04-01T00:00:00.000Z",
          detailedRuns: [],
          weeklyRollups: [],
        },
        historyQuality: {
          hasAnyHistory: true,
          meetsSnapshotThreshold: true,
          hasRecentSync: true,
          latestSyncWarnings: [],
          availableDateRange: {
            start: "2026-03-01T00:00:00.000Z",
            end: "2026-03-30T00:00:00.000Z",
          },
        },
        performanceSnapshot: {
          allTimePrs: [],
          recentPrs: [],
          processingWarnings: [],
        },
        userPerceivedAbility: USER_PERCEIVED_ABILITY_LEVELS.intermediate,
        corexPerceivedAbility: {
          level: COREX_PERCEIVED_ABILITY_LEVELS.intermediate,
          rationale: "Stable running history.",
        },
        longRunDay: DAYS_OF_WEEK.saturday,
        startDate: "2026-04-06",
        endDate: "2026-04-12",
        planDurationWeeks: 4,
      },
      payload: {
        days: Array.from({ length: 7 }, (_, index) => ({
          date: `2026-04-${String(index + 6).padStart(2, "0")}`,
          session: null,
        })),
      },
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    expect(parsed.generationContext.generationMode).toBe("initial");
    expect(parsed.generationContext.parentWeeklyPlanId).toBeNull();
    expect(parsed.generationContext.previousPlanWindow).toBeNull();
    expect(parsed.generationContext.currentDayOfWeek).toBe(
      DAYS_OF_WEEK.wednesday,
    );
    expect(parsed.generationContext.startDateDayOfWeek).toBe(
      DAYS_OF_WEEK.monday,
    );
  });
});
