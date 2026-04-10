import {
  buildActivityCalendar,
  getLocalDateKey,
  type ActivityCalendarQueryInput,
  type CalendarActivity,
  type CalendarActivityRecord,
  type CalendarWeekSummary,
} from "../activity-history/activity-calendar";
import type {
  PlannedSession,
  WeeklyPlanDraft,
} from "../weekly-planning/contracts";

export type TrainingCalendarLinkRecord = {
  weeklyPlanId: string;
  plannedDate: string;
  activityId: string;
};

export type TrainingCalendarPlannedSession = {
  date: string;
  status: "planned" | "completed";
  sessionType: PlannedSession["sessionType"];
  title: string;
  summary: string;
  estimatedDurationSeconds: number;
  estimatedDistanceMeters: number | null;
  linkedActivity: CalendarActivity | null;
  candidateActivities: CalendarActivity[];
};

export type TrainingCalendarMonth = {
  weeks: CalendarWeekSummary[];
  activities: CalendarActivity[];
  plannedSessions: TrainingCalendarPlannedSession[];
};

type BuildTrainingCalendarMonthState = {
  draft: Pick<WeeklyPlanDraft, "id" | "payload"> | null;
  activityRecords: CalendarActivityRecord[];
  links: TrainingCalendarLinkRecord[];
};

export function buildTrainingCalendarMonth(
  input: ActivityCalendarQueryInput,
  state: BuildTrainingCalendarMonthState,
): TrainingCalendarMonth {
  const activityCalendar = buildActivityCalendar(input, state.activityRecords);
  const activityById = new Map(
    activityCalendar.activities.map((activity) => [activity.id, activity]),
  );
  const linkedActivityIds = new Set(state.links.map((link) => link.activityId));
  const visibleActivities = activityCalendar.activities.filter(
    (activity) => !linkedActivityIds.has(activity.id),
  );
  const unlinkedActivitiesByDate = visibleActivities.reduce<
    Map<string, CalendarActivity[]>
  >((acc, activity) => {
    const key = getLocalDateKey(new Date(activity.startDate), input.timezone);
    acc.set(key, [...(acc.get(key) ?? []), activity]);
    return acc;
  }, new Map());

  if (!state.draft) {
    return {
      weeks: activityCalendar.weeks,
      activities: visibleActivities,
      plannedSessions: [],
    };
  }

  const visibleDates = createVisibleDateRange(input);
  const linkByPlannedDate = new Map(
    state.links
      .filter((link) => link.weeklyPlanId === state.draft?.id)
      .map((link) => [link.plannedDate, link]),
  );

  const plannedSessions = state.draft.payload.days
    .filter(
      (day) =>
        day.date >= visibleDates.firstDate && day.date <= visibleDates.lastDate,
    )
    .flatMap((day) => {
      if (!day.session) {
        return [];
      }

      const link = linkByPlannedDate.get(day.date);
      const linkedActivity = link
        ? (activityById.get(link.activityId) ?? null)
        : null;

      return [
        {
          date: day.date,
          status: linkedActivity ? "completed" : "planned",
          sessionType: day.session.sessionType,
          title: day.session.title,
          summary: day.session.summary,
          estimatedDurationSeconds: day.session.estimatedDurationSeconds,
          estimatedDistanceMeters: day.session.estimatedDistanceMeters,
          linkedActivity,
          candidateActivities: linkedActivity
            ? []
            : [...(unlinkedActivitiesByDate.get(day.date) ?? [])],
        } satisfies TrainingCalendarPlannedSession,
      ];
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
