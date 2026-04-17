import { getLocalDateKey } from "../activity-history/activity-calendar";
import type {
  PlannedSession,
  WeeklyPlanPayload,
} from "../weekly-planning/contracts";
import type {
  PlanAdherenceActivity,
  PlanAdherenceExtraSession,
  PlanAdherenceSession,
  PlanAdherenceStatus,
  PlanAdherenceSummary,
} from "./contracts";

const completionThreshold = 0.8;
const fallbackActivityName = "Untitled run";

type PlannedRunSession = PlannedSession & {
  sessionType: Exclude<PlannedSession["sessionType"], "rest">;
};

export type PlanAdherencePlan = {
  id: string;
  startDate: string;
  endDate: string;
  payload: WeeklyPlanPayload;
};

export type PlanAdherenceActivityRecord = {
  id: string;
  name: string | null;
  startDate: Date;
  elapsedTime: number | null;
  distance: number;
};

export type PlanAdherenceLinkRecord = {
  weeklyPlanId: string;
  plannedDate: string;
  activityId: string;
};

export function isPlannedRunSession(
  session: WeeklyPlanPayload["days"][number]["session"],
): session is PlannedRunSession {
  return session != null && session.sessionType !== "rest";
}

function round(value: number, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function mapActivity(
  activity: PlanAdherenceActivityRecord,
  timezone: string,
): PlanAdherenceActivity {
  return {
    activityId: activity.id,
    name:
      typeof activity.name === "string" && activity.name.trim().length > 0
        ? activity.name
        : fallbackActivityName,
    startDate: activity.startDate.toISOString(),
    localDate: getLocalDateKey(activity.startDate, timezone),
    distanceMeters: activity.distance,
    durationSeconds: activity.elapsedTime,
  };
}

function calculateCompletion(input: {
  plannedDistanceMeters: number | null;
  plannedDurationSeconds: number;
  activity: PlanAdherenceActivity | null;
}) {
  if (!input.activity) {
    return {
      distanceCompletionRatio: null,
      durationCompletionRatio: null,
      targetCompletionRatio: 0,
    };
  }

  const distanceCompletionRatio =
    input.plannedDistanceMeters != null && input.plannedDistanceMeters > 0
      ? input.activity.distanceMeters / input.plannedDistanceMeters
      : null;
  const durationCompletionRatio =
    input.plannedDurationSeconds > 0 && input.activity.durationSeconds != null
      ? input.activity.durationSeconds / input.plannedDurationSeconds
      : null;
  const targetCompletionRatio = Math.min(
    Math.max(distanceCompletionRatio ?? 0, durationCompletionRatio ?? 0),
    1,
  );

  return {
    distanceCompletionRatio:
      distanceCompletionRatio == null ? null : round(distanceCompletionRatio),
    durationCompletionRatio:
      durationCompletionRatio == null ? null : round(durationCompletionRatio),
    targetCompletionRatio: round(targetCompletionRatio),
  };
}

function classifyLinkedSession(input: {
  plannedDate: string;
  actualLocalDate: string;
  targetCompletionRatio: number;
}): PlanAdherenceStatus {
  if (input.targetCompletionRatio < completionThreshold) {
    return "partial";
  }

  return input.actualLocalDate === input.plannedDate ? "completed" : "moved";
}

function countStatus(
  sessions: PlanAdherenceSession[],
  status: PlanAdherenceStatus,
) {
  return sessions.filter((session) => session.status === status).length;
}

export function buildPlanAdherenceSummary(input: {
  plan: PlanAdherencePlan;
  timezone: string;
  currentLocalDate: string;
  activities: PlanAdherenceActivityRecord[];
  links: PlanAdherenceLinkRecord[];
}): PlanAdherenceSummary {
  const activities = input.activities.map((activity) =>
    mapActivity(activity, input.timezone),
  );
  const activityById = new Map(
    activities.map((activity) => [activity.activityId, activity]),
  );
  const linksByPlannedDate = new Map(
    input.links
      .filter((link) => link.weeklyPlanId === input.plan.id)
      .map((link) => [link.plannedDate, link]),
  );
  const linkedActivityIds = new Set(
    [...linksByPlannedDate.values()].map((link) => link.activityId),
  );

  const sessions = input.plan.payload.days.flatMap((day) => {
    if (!isPlannedRunSession(day.session)) {
      return [];
    }

    const link = linksByPlannedDate.get(day.date);
    const linkedActivity = link
      ? (activityById.get(link.activityId) ?? null)
      : null;
    const completion = calculateCompletion({
      plannedDistanceMeters: day.session.estimatedDistanceMeters,
      plannedDurationSeconds: day.session.estimatedDurationSeconds,
      activity: linkedActivity,
    });
    const status = linkedActivity
      ? classifyLinkedSession({
          plannedDate: day.date,
          actualLocalDate: linkedActivity.localDate,
          targetCompletionRatio: completion.targetCompletionRatio,
        })
      : day.date < input.currentLocalDate
        ? "missed"
        : "planned";

    return [
      {
        plannedDate: day.date,
        status,
        sessionType: day.session.sessionType,
        title: day.session.title,
        plannedDistanceMeters: day.session.estimatedDistanceMeters,
        plannedDurationSeconds: day.session.estimatedDurationSeconds,
        actualLocalDate: linkedActivity?.localDate ?? null,
        linkedActivity,
        ...completion,
      } satisfies PlanAdherenceSession,
    ];
  });

  const extras = activities
    .filter(
      (activity) =>
        !linkedActivityIds.has(activity.activityId) &&
        activity.localDate >= input.plan.startDate &&
        activity.localDate <= input.plan.endDate,
    )
    .map(
      (activity): PlanAdherenceExtraSession => ({
        activityId: activity.activityId,
        name: activity.name,
        startDate: activity.startDate,
        localDate: activity.localDate,
        distanceMeters: activity.distanceMeters,
        durationSeconds: activity.durationSeconds,
      }),
    );

  const completedCount = countStatus(sessions, "completed");
  const movedCount = countStatus(sessions, "moved");
  const partialCount = countStatus(sessions, "partial");
  const missedCount = countStatus(sessions, "missed");
  const plannedCount = countStatus(sessions, "planned");
  const plannedSessionCount = sessions.length;
  const targetCompletionTotal = sessions.reduce(
    (sum, session) => sum + session.targetCompletionRatio,
    0,
  );

  return {
    planId: input.plan.id,
    startDate: input.plan.startDate,
    endDate: input.plan.endDate,
    timezone: input.timezone,
    currentLocalDate: input.currentLocalDate,
    sessions,
    extras,
    totals: {
      plannedSessionCount,
      completedCount,
      movedCount,
      partialCount,
      missedCount,
      plannedCount,
      extraCount: extras.length,
      adheredSessionRatio:
        plannedSessionCount > 0
          ? round((completedCount + movedCount) / plannedSessionCount)
          : null,
      targetCompletionRatio:
        plannedSessionCount > 0
          ? round(targetCompletionTotal / plannedSessionCount)
          : null,
      plannedDistanceMeters: round(
        sessions.reduce(
          (sum, session) => sum + (session.plannedDistanceMeters ?? 0),
          0,
        ),
        1,
      ),
      completedDistanceMeters: round(
        sessions.reduce(
          (sum, session) => sum + (session.linkedActivity?.distanceMeters ?? 0),
          0,
        ),
        1,
      ),
      plannedDurationSeconds: sessions.reduce(
        (sum, session) => sum + session.plannedDurationSeconds,
        0,
      ),
      completedDurationSeconds: sessions.reduce(
        (sum, session) => sum + (session.linkedActivity?.durationSeconds ?? 0),
        0,
      ),
    },
  };
}
