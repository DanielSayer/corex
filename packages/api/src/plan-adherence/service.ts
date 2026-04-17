import { Effect } from "effect";

import {
  addDaysToDateKey,
  getLocalDateKey,
  localDateKeyToUtcStart,
} from "../goal-progress/timezones";
import type { TrainingSettingsService } from "../training-settings/service";
import type { WeeklyPlanningRepository } from "../weekly-planning/repository";
import { buildPlanAdherenceSummary } from "./domain";
import type { PlanAdherenceSummary, SummaryForPlanInput } from "./contracts";
import { summaryForPlanInputSchema } from "./contracts";
import {
  PlanAdherencePlanNotFound,
  PlanAdherenceValidationError,
} from "./errors";
import type { PlanAdherenceRepository } from "./repository";

type Clock = {
  now: () => Date;
};

export type PlanAdherenceService = ReturnType<
  typeof createPlanAdherenceService
>;

export function createPlanAdherenceService(options: {
  repo: PlanAdherenceRepository;
  trainingSettingsService: Pick<TrainingSettingsService, "getTimezoneForUser">;
  weeklyPlanningRepo: Pick<WeeklyPlanningRepository, "getPlanById">;
  clock?: Clock;
}) {
  const clock = options.clock ?? { now: () => new Date() };

  return {
    summaryForPlan(
      userId: string,
      rawInput: SummaryForPlanInput,
    ): Effect.Effect<PlanAdherenceSummary, unknown> {
      return Effect.gen(function* () {
        const input = yield* Effect.try({
          try: () => summaryForPlanInputSchema.parse(rawInput),
          catch: (cause) =>
            new PlanAdherenceValidationError(
              cause instanceof Error
                ? cause.message
                : "Invalid plan adherence input",
            ),
        });
        const [timezone, plan] = yield* Effect.all([
          options.trainingSettingsService.getTimezoneForUser(userId),
          options.weeklyPlanningRepo.getPlanById(userId, input.planId),
        ]);

        if (!plan) {
          return yield* Effect.fail(
            new PlanAdherencePlanNotFound("Weekly plan could not be found"),
          );
        }

        const from = localDateKeyToUtcStart(plan.startDate, timezone);
        const to = localDateKeyToUtcStart(
          addDaysToDateKey(plan.endDate, 1),
          timezone,
        );
        const [activities, links] = yield* Effect.all([
          options.repo.listActivitiesInRange(userId, { from, to }),
          options.repo.listLinksForPlan(userId, plan.id),
        ]);

        return buildPlanAdherenceSummary({
          plan,
          timezone,
          currentLocalDate: getLocalDateKey(clock.now(), timezone),
          activities,
          links,
        });
      });
    },
  };
}
