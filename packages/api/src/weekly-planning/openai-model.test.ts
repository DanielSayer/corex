import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";

import type { DraftGenerationContext, WeeklyPlanPayload } from "./contracts";
import { SUPPORTED_RACE_DISTANCES, TRAINING_PLAN_GOALS } from "./contracts";
import { GenerationTimeout, ProviderFailure } from "./errors";
import { createOpenAiPlannerModel } from "./openai-model";

function createContext(): DraftGenerationContext {
  return {
    plannerIntent: {
      planGoal: TRAINING_PLAN_GOALS.race,
      raceBenchmark: {
        estimatedRaceDistance: SUPPORTED_RACE_DISTANCES["10k"],
        estimatedRaceTimeSeconds: 3000,
      },
    },
    generationMode: "initial",
    parentWeeklyPlanId: null,
    previousPlanWindow: null,
    availability: {
      monday: { available: true, maxDurationMinutes: 45 },
      tuesday: { available: true, maxDurationMinutes: 45 },
      wednesday: { available: true, maxDurationMinutes: 60 },
      thursday: { available: true, maxDurationMinutes: 45 },
      friday: { available: true, maxDurationMinutes: 45 },
      saturday: { available: true, maxDurationMinutes: 120 },
      sunday: { available: true, maxDurationMinutes: 45 },
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
        end: "2026-03-31T00:00:00.000Z",
      },
    },
    performanceSnapshot: {
      allTimePrs: [],
      recentPrs: [],
      processingWarnings: [],
    },
    userPerceivedAbility: "intermediate",
    corexPerceivedAbility: {
      level: "intermediate",
      rationale: "Recent training load supports an intermediate plan.",
    },
    currentDate: "2026-04-01",
    currentDayOfWeek: "wednesday",
    longRunDay: "saturday",
    startDate: "2026-04-06",
    startDateDayOfWeek: "monday",
    endDate: "2026-05-24",
    planDurationWeeks: 7,
  };
}

function createPayload(): WeeklyPlanPayload {
  return {
    days: [
      {
        date: "2026-04-06",
        session: null,
      },
      {
        date: "2026-04-07",
        session: null,
      },
      {
        date: "2026-04-08",
        session: null,
      },
      {
        date: "2026-04-09",
        session: null,
      },
      {
        date: "2026-04-10",
        session: null,
      },
      {
        date: "2026-04-11",
        session: {
          sessionType: "long_run",
          title: "Long run",
          summary: "Steady aerobic long run.",
          coachingNotes: null,
          estimatedDurationSeconds: 5400,
          estimatedDistanceMeters: 14000,
          intervalBlocks: [],
        },
      },
      {
        date: "2026-04-12",
        session: null,
      },
    ],
  };
}

describe("openai planner model", () => {
  it("returns the structured weekly plan from generateText output", async () => {
    const payload = createPayload();
    const generateTextCalls: Array<Record<string, unknown>> = [];

    const model = createOpenAiPlannerModel(
      {
        apiKey: "test-key",
        model: "gpt-test",
      },
      {
        createClient: () => ((modelName: string) => ({ modelName })) as never,
        generateText: (async (input) => {
          generateTextCalls.push(input as Record<string, unknown>);

          return {
            output: payload,
          } as Awaited<ReturnType<typeof import("ai").generateText>>;
        }) as typeof import("ai").generateText,
      },
    );

    await expect(
      Effect.runPromise(model.generateWeeklyPlan(createContext())),
    ).resolves.toEqual(payload);

    expect(generateTextCalls).toHaveLength(1);
    expect(generateTextCalls[0]?.system).toContain(
      "Return structured JSON only.",
    );
    expect(generateTextCalls[0]?.system).toContain(
      "Treat availability as an upper bound, not a target number of runs.",
    );
    expect(generateTextCalls[0]?.system).toContain(
      "Use historySnapshot.detailedRuns and historySnapshot.weeklyRollups to infer the athlete's current running pattern",
    );
    expect(generateTextCalls[0]?.system).toContain(
      "For beginner or limited-history athletes, prefer fewer running days and more rest",
    );
    expect(generateTextCalls[0]?.prompt).toBe(JSON.stringify(createContext()));
  });

  it("maps timeout failures to GenerationTimeout", async () => {
    const model = createOpenAiPlannerModel(
      {
        apiKey: "test-key",
        model: "gpt-test",
      },
      {
        createClient: () => ((modelName: string) => ({ modelName })) as never,
        generateText: (async () => {
          throw new Error("request timeout while generating response");
        }) as typeof import("ai").generateText,
      },
    );

    const exit = await Effect.runPromiseExit(
      model.generateWeeklyPlan(createContext()),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(GenerationTimeout);
      }
    }
  });

  it("maps non-timeout failures to ProviderFailure", async () => {
    const model = createOpenAiPlannerModel(
      {
        apiKey: "test-key",
        model: "gpt-test",
      },
      {
        createClient: () => ((modelName: string) => ({ modelName })) as never,
        generateText: (async () => {
          throw new Error("provider unavailable");
        }) as typeof import("ai").generateText,
      },
    );

    const exit = await Effect.runPromiseExit(
      model.generateWeeklyPlan(createContext()),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(ProviderFailure);
        expect(failure.value.message).toBe(
          "Weekly plan generation failed: provider unavailable",
        );
      }
    }
  });

  it("surfaces authentication failures with config guidance", async () => {
    const model = createOpenAiPlannerModel(
      {
        apiKey: "test-key",
        model: "gpt-test",
      },
      {
        createClient: () => ((modelName: string) => ({ modelName })) as never,
        generateText: (async () => {
          throw new Error("Incorrect API key provided");
        }) as typeof import("ai").generateText,
      },
    );

    const exit = await Effect.runPromiseExit(
      model.generateWeeklyPlan(createContext()),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(ProviderFailure);
        expect(failure.value.message).toContain(
          "OpenAI API authentication failed",
        );
        expect(failure.value.message).toContain("OPENAI_API_KEY");
      }
    }
  });

  it("surfaces model configuration failures with model guidance", async () => {
    const model = createOpenAiPlannerModel(
      {
        apiKey: "test-key",
        model: "bad-model",
      },
      {
        createClient: () => ((modelName: string) => ({ modelName })) as never,
        generateText: (async () => {
          throw new Error("The model `bad-model` does not exist");
        }) as typeof import("ai").generateText,
      },
    );

    const exit = await Effect.runPromiseExit(
      model.generateWeeklyPlan(createContext()),
    );

    expect(Exit.isFailure(exit)).toBe(true);

    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);

      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(ProviderFailure);
        expect(failure.value.message).toContain('configured model "bad-model"');
        expect(failure.value.message).toContain("PLANNER_OPENAI_MODEL");
      }
    }
  });
});
