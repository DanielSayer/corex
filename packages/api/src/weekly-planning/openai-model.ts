import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { Effect } from "effect";

import type { DraftGenerationContext } from "./contracts";
import { weeklyPlanPayloadSchema } from "./contracts";
import { GenerationTimeout, ProviderFailure } from "./errors";
import type { PlannerModelPort } from "./model";

function buildSystemPrompt() {
  return [
    "You are generating a running-only weekly training draft.",
    "Return structured JSON only.",
    "Produce exactly 7 days starting at the provided startDate.",
    "Use only supported session types: rest, easy_run, long_run, workout.",
    "Use only supported interval block types: warmup, steady, work, recovery, cooldown.",
    "Schedule exactly one long_run on the requested longRunDay.",
    "Never exceed the day's availability max duration when one exists.",
  ].join(" ");
}

function buildUserPrompt(context: DraftGenerationContext) {
  return JSON.stringify(context);
}

export function createOpenAiPlannerModel(options: {
  apiKey: string;
  model: string;
}): PlannerModelPort {
  const openai = createOpenAI({
    apiKey: options.apiKey,
  });

  return {
    provider: "openai",
    model: options.model,
    generateWeeklyPlan(context) {
      return Effect.tryPromise({
        try: async () => {
          const result = await generateObject({
            model: openai(options.model),
            schema: weeklyPlanPayloadSchema,
            system: buildSystemPrompt(),
            prompt: buildUserPrompt(context),
          });

          return result.object;
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
            message: "Weekly plan generation failed",
            cause,
          });
        },
      });
    },
  };
}
