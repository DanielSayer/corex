import { Effect } from "effect";

import { getLocalDateKey } from "../activity-history/activity-calendar";
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

export type TrainingCalendarService = ReturnType<
  typeof createTrainingCalendarService
>;

export function createTrainingCalendarService(options: {
  repo: TrainingCalendarRepository;
  weeklyPlanningRepo: Pick<WeeklyPlanningRepository, "getActiveDraft">;
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
        const [draft, activityRecords] = yield* Effect.all([
          Effect.mapError(
            options.weeklyPlanningRepo.getActiveDraft(userId),
            mapWeeklyPlanningError,
          ),
          options.repo.listActivitiesInRange(userId, input),
        ]);
        const links = draft
          ? yield* options.repo.listLinksForDraft(userId, draft.id)
          : [];

        return buildTrainingCalendarMonth(input, {
          draft,
          activityRecords,
          links,
        });
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
        const draft = yield* Effect.mapError(
          options.weeklyPlanningRepo.getActiveDraft(userId),
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
          getLocalDateKey(activity.startDate, input.timezone) !==
          input.plannedDate
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
