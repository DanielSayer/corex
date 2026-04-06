import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { Effect } from "effect";

import type { DraftGenerationContext } from "./contracts";
import { weeklyPlanPayloadSchema } from "./contracts";
import { GenerationTimeout, ProviderFailure } from "./errors";
import type { PlannerModelPort } from "./model";

type OpenAiPlannerModelDependencies = {
  createClient: typeof createOpenAI;
  generateText: typeof generateText;
};

const defaultDependencies: OpenAiPlannerModelDependencies = {
  createClient: createOpenAI,
  generateText,
};

function describeProviderFailure(message: string, model: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("incorrect api key") ||
    normalized.includes("invalid api key") ||
    normalized.includes("authentication")
  ) {
    return "Weekly plan generation failed: OpenAI API authentication failed. Check OPENAI_API_KEY.";
  }

  if (
    normalized.includes("model") &&
    (normalized.includes("not found") || normalized.includes("does not exist"))
  ) {
    return `Weekly plan generation failed: configured model "${model}" is unavailable. Check PLANNER_OPENAI_MODEL.`;
  }

  if (
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return "Weekly plan generation failed: OpenAI quota or rate limit reached. Retry shortly or check billing.";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound")
  ) {
    return "Weekly plan generation failed: OpenAI could not be reached from the server.";
  }

  return `Weekly plan generation failed: ${message}`;
}

function buildSystemPrompt() {
  return [
    "You are generating a running-only weekly training draft.",
    "Return structured JSON only.",
    "Produce exactly 7 days starting at the provided startDate.",
    "Use only supported session types: rest, easy_run, long_run, workout.",
    "Use only supported interval block types: warmup, steady, work, recovery, cooldown.",
    "Schedule exactly one long_run on the requested longRunDay.",
    "Never exceed the day's availability max duration when one exists.",
    "Treat availability as an upper bound, not a target number of runs.",
    "Use historySnapshot.detailedRuns and historySnapshot.weeklyRollups to infer the athlete's current running pattern, including weekly frequency, long-run habit, recent volume, and consistency.",
    "Use userPerceivedAbility and corexPerceivedAbility together to choose an appropriate level of training stress, complexity, and recovery.",
    "For beginner or limited-history athletes, prefer fewer running days and more rest; do not schedule a run on every available day unless the history clearly supports that frequency.",
    "Keep the draft close to the athlete's recent pattern, then make only a sensible step toward the plan goal rather than a dramatic jump.",
    "Bias workouts and long-run sizing to the goal, but preserve a believable week that the athlete could complete right now.",
    "If history is sparse, inconsistent, or not recent, choose the more conservative interpretation.",
    "Use rest days when needed to support recovery and adaptation.",
  ].join(" ");
}

function buildUserPrompt(context: DraftGenerationContext) {
  return JSON.stringify(context);
}

export function createOpenAiPlannerModel(options: {
  apiKey: string;
  model: string;
}): PlannerModelPort;
export function createOpenAiPlannerModel(
  options: {
    apiKey: string;
    model: string;
  },
  dependencies: OpenAiPlannerModelDependencies,
): PlannerModelPort;
export function createOpenAiPlannerModel(
  options: {
    apiKey: string;
    model: string;
  },
  dependencies: OpenAiPlannerModelDependencies = defaultDependencies,
): PlannerModelPort {
  const openai = dependencies.createClient({
    apiKey: options.apiKey,
  });

  return {
    provider: "openai",
    model: options.model,
    generateWeeklyPlan(context) {
      return Effect.tryPromise({
        try: async () => {
          const result = await dependencies.generateText({
            model: openai(options.model),
            system: buildSystemPrompt(),
            prompt: buildUserPrompt(context),
            output: Output.object({
              schema: weeklyPlanPayloadSchema,
            }),
          });

          return result.output;
        },
        catch: (cause) => {
          const message =
            cause instanceof Error ? cause.message : String(cause);

          if (message.toLowerCase().includes("timeout")) {
            return new GenerationTimeout({
              message: "Weekly plan generation timed out",
              cause,
            });
          }

          return new ProviderFailure({
            message: describeProviderFailure(message, options.model),
            cause,
          });
        },
      });
    },
  };
}
