import { Effect } from "effect";

import { getLocalDateKey } from "../activity-history/activity-calendar";
import type { TrainingSettingsService } from "../training-settings/service";
import type { WeeklyPlanningRepository } from "../weekly-planning/repository";
import type {
  LinkTrainingCalendarActivityInput,
  TrainingCalendarMonthInput,
} from "./contracts";
import {
  buildTrainingCalendarMonth,
  type TrainingCalendarMonth,
} from "./domain";
import {
  InvalidTrainingCalendarLink,
  MissingActiveDraft,
  TrainingCalendarLinkConflict,
  TrainingCalendarPersistenceFailure,
} from "./errors";
import type { TrainingCalendarRepository } from "./repository";

function mapWeeklyPlanningError(cause: unknown) {
  return new TrainingCalendarPersistenceFailure({
    message: "Failed to load active weekly plan draft",
    cause,
  });
}

function mapTimezoneError(cause: unknown) {
  return new TrainingCalendarPersistenceFailure({
    message: "Failed to load training timezone",
    cause,
  });
}

export type TrainingCalendarService = ReturnType<
  typeof createTrainingCalendarService
>;

export function createTrainingCalendarService(options: {
  repo: TrainingCalendarRepository;
  trainingSettingsService: Pick<TrainingSettingsService, "getTimezoneForUser">;
  weeklyPlanningRepo: Pick<
    WeeklyPlanningRepository,
    "getPlanForDate" | "listPlansInRange"
  >;
}) {
  return {
    month(
      userId: string,
      input: TrainingCalendarMonthInput,
    ): Effect.Effect<
      TrainingCalendarMonth,
      TrainingCalendarPersistenceFailure
    > {
      return Effect.gen(function* () {
        const timezone = yield* Effect.mapError(
          options.trainingSettingsService.getTimezoneForUser(userId),
          mapTimezoneError,
        );
        const [plans, activityRecords] = yield* Effect.all([
          Effect.mapError(
            options.weeklyPlanningRepo.listPlansInRange(userId, {
              startDate: getLocalDateKey(new Date(input.from), timezone),
              endDate: getLocalDateKey(
                new Date(new Date(input.to).getTime() - 1),
                timezone,
              ),
            }),
            mapWeeklyPlanningError,
          ),
          options.repo.listActivitiesInRange(userId, input),
        ]);
        const links = yield* Effect.forEach(plans, (plan) =>
          options.repo.listLinksForDraft(userId, plan.id),
        ).pipe(Effect.map((results) => results.flat()));

        return buildTrainingCalendarMonth(
          {
            ...input,
            timezone,
          },
          {
            plans,
            activityRecords,
            links,
          },
        );
      });
    },
    linkActivity(
      userId: string,
      input: LinkTrainingCalendarActivityInput,
    ): Effect.Effect<
      { plannedDate: string; activityId: string },
      | TrainingCalendarPersistenceFailure
      | MissingActiveDraft
      | InvalidTrainingCalendarLink
      | TrainingCalendarLinkConflict
    > {
      return Effect.gen(function* () {
        const timezone = yield* Effect.mapError(
          options.trainingSettingsService.getTimezoneForUser(userId),
          mapTimezoneError,
        );
        const draft = yield* Effect.mapError(
          options.weeklyPlanningRepo.getPlanForDate(userId, input.plannedDate),
          mapWeeklyPlanningError,
        );

        if (!draft) {
          return yield* Effect.fail(
            new MissingActiveDraft({
              message: "An active draft is required before linking activities",
            }),
          );
        }

        const plannedDay = draft.payload.days.find(
          (day) => day.date === input.plannedDate,
        );

        if (!plannedDay?.session) {
          return yield* Effect.fail(
            new InvalidTrainingCalendarLink({
              message: "Selected planned day does not have a scheduled session",
            }),
          );
        }

        const [activity, existingPlannedDateLink, existingActivityLink] =
          yield* Effect.all([
            options.repo.getActivity(userId, input.activityId),
            options.repo.getLinkForPlannedDate(
              userId,
              draft.id,
              input.plannedDate,
            ),
            options.repo.getLinkForActivity(userId, input.activityId),
          ]);

        if (!activity) {
          return yield* Effect.fail(
            new InvalidTrainingCalendarLink({
              message: "Selected activity does not exist for this user",
            }),
          );
        }

        if (
          getLocalDateKey(activity.startDate, timezone) !== input.plannedDate
        ) {
          return yield* Effect.fail(
            new InvalidTrainingCalendarLink({
              message:
                "Selected activity must occur on the same local calendar date as the planned session",
            }),
          );
        }

        if (existingPlannedDateLink) {
          return yield* Effect.fail(
            new TrainingCalendarLinkConflict({
              message: "This planned session is already linked to an activity",
            }),
          );
        }

        if (existingActivityLink) {
          return yield* Effect.fail(
            new TrainingCalendarLinkConflict({
              message: "This activity is already linked to a planned session",
            }),
          );
        }

        const link = yield* options.repo.createLink({
          userId,
          weeklyPlanId: draft.id,
          plannedDate: input.plannedDate,
          activityId: input.activityId,
        });

        return {
          plannedDate: link.plannedDate,
          activityId: link.activityId,
        };
      });
    },
  };
}
