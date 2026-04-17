import {
  buildActivityCalendar,
  getLocalDateKey,
  type ActivityCalendarQueryInput,
  type CalendarActivity,
  type CalendarActivityRecord,
  type CalendarWeekSummary,
} from "../activity-history/activity-calendar";
import type { PlanAdherenceStatus } from "../plan-adherence/contracts";
import { buildPlanAdherenceSummary } from "../plan-adherence/domain";
import type { PlannedSession, WeeklyPlan } from "../weekly-planning/contracts";

export type TrainingCalendarLinkRecord = {
  weeklyPlanId: string;
  plannedDate: string;
  activityId: string;
};

export type TrainingCalendarPlannedSession = {
  date: string;
  status: PlanAdherenceStatus;
  sessionType: PlannedSession["sessionType"];
  title: string;
  summary: string;
  estimatedDurationSeconds: number;
  estimatedDistanceMeters: number | null;
  actualLocalDate: string | null;
  targetCompletionRatio: number;
  linkedActivity: CalendarActivity | null;
  candidateActivities: CalendarActivity[];
};

export type TrainingCalendarMonth = {
  weeks: CalendarWeekSummary[];
  activities: CalendarActivity[];
  plannedSessions: TrainingCalendarPlannedSession[];
};

type BuildTrainingCalendarMonthState = {
  plans: Array<Pick<WeeklyPlan, "id" | "startDate" | "endDate" | "payload">>;
  activityRecords: CalendarActivityRecord[];
  links: TrainingCalendarLinkRecord[];
  currentLocalDate: string;
};

export function buildTrainingCalendarMonth(
  input: ActivityCalendarQueryInput,
  state: BuildTrainingCalendarMonthState,
): TrainingCalendarMonth {
  const activityCalendar = buildActivityCalendar(input, state.activityRecords);
  const activityById = new Map(
    activityCalendar.activities.map((activity) => [activity.id, activity]),
  );
  const adherenceByPlanId = new Map(
    state.plans.map((plan) => [
      plan.id,
      buildPlanAdherenceSummary({
        plan,
        timezone: input.timezone,
        currentLocalDate: state.currentLocalDate,
        activities: state.activityRecords.map((activity) => ({
          id: activity.id,
          name: activity.name,
          startDate: activity.startDate,
          elapsedTime: activity.elapsedTime,
          distance: activity.distance,
        })),
        links: state.links,
      }),
    ]),
  );
  const sameDayCompletedLinkedActivityIds = new Set(
    [...adherenceByPlanId.values()].flatMap((summary) =>
      summary.sessions
        .filter(
          (session) =>
            session.status === "completed" &&
            session.linkedActivity &&
            session.actualLocalDate === session.plannedDate,
        )
        .map((session) => session.linkedActivity!.activityId),
    ),
  );
  const visibleActivities = activityCalendar.activities.filter(
    (activity) => !sameDayCompletedLinkedActivityIds.has(activity.id),
  );
  const linkedActivityIds = new Set(state.links.map((link) => link.activityId));
  const candidateActivities = activityCalendar.activities.filter(
    (activity) => !linkedActivityIds.has(activity.id),
  );

  if (state.plans.length === 0) {
    return {
      weeks: activityCalendar.weeks,
      activities: visibleActivities,
      plannedSessions: [],
    };
  }

  const visibleDates = createVisibleDateRange(input);
  const plannedSessions = state.plans.flatMap((plan) => {
    const linkByPlannedDate = new Map(
      state.links
        .filter((link) => link.weeklyPlanId === plan.id)
        .map((link) => [link.plannedDate, link]),
    );

    return plan.payload.days
      .filter(
        (day) =>
          day.date >= visibleDates.firstDate &&
          day.date <= visibleDates.lastDate,
      )
      .flatMap((day) => {
        if (!day.session || day.session.sessionType === "rest") {
          return [];
        }

        const link = linkByPlannedDate.get(day.date);
        const linkedActivity = link
          ? (activityById.get(link.activityId) ?? null)
          : null;
        const adherenceSession =
          adherenceByPlanId
            .get(plan.id)
            ?.sessions.find((session) => session.plannedDate === day.date) ??
          null;
        const weekCandidateActivities = candidateActivities.filter(
          (activity) => {
            const localDate = getLocalDateKey(
              new Date(activity.startDate),
              input.timezone,
            );
            return localDate >= plan.startDate && localDate <= plan.endDate;
          },
        );

        return [
          {
            date: day.date,
            status: adherenceSession?.status ?? "planned",
            sessionType: day.session.sessionType,
            title: day.session.title,
            summary: day.session.summary,
            estimatedDurationSeconds: day.session.estimatedDurationSeconds,
            estimatedDistanceMeters: day.session.estimatedDistanceMeters,
            actualLocalDate: adherenceSession?.actualLocalDate ?? null,
            targetCompletionRatio: adherenceSession?.targetCompletionRatio ?? 0,
            linkedActivity,
            candidateActivities: linkedActivity ? [] : weekCandidateActivities,
          } satisfies TrainingCalendarPlannedSession,
        ];
      });
  });

  return {
    weeks: activityCalendar.weeks,
    activities: visibleActivities,
    plannedSessions,
  };
}

function createVisibleDateRange(input: ActivityCalendarQueryInput) {
  return {
    firstDate: getLocalDateKey(new Date(input.from), input.timezone),
    lastDate: getLocalDateKey(
      new Date(new Date(input.to).getTime() - 1),
      input.timezone,
    ),
  };
}
