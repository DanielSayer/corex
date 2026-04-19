export type ActivityCalendarQueryInput = {
  from: string;
  to: string;
  timezone: string;
};

export type CalendarActivity = {
  id: string;
  name: string;
  startDate: string;
  elapsedTime: number | null;
  distance: number;
  averagePaceSecondsPerKm: number | null;
  averageHeartrate: number | null;
  trainingLoad: number | null;
  totalElevationGain: number | null;
};

export type CalendarWeekSummary = {
  weekStart: string;
  weekEnd: string;
  time: number;
  distance: number;
  totalElevationGain: number;
  averagePaceSecondsPerKm: number | null;
};

export type ActivityCalendarData = {
  activities: CalendarActivity[];
  weeks: CalendarWeekSummary[];
};

export type CalendarActivityRecord = {
  id: string;
  name: string | null;
  startDate: Date;
  summaryDate?: string;
  elapsedTime: number | null;
  distance: number;
  averageHeartrate: number | null;
  trainingLoad: number | null;
  totalElevationGain: number | null;
};

type MutableWeekSummary = CalendarWeekSummary & {
  paceDistanceMeters: number;
  paceElapsedTimeSeconds: number;
};

const untitledActivityName = "Untitled run";

export function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function calculateAveragePaceSecondsPerKm(
  elapsedTimeSeconds: number | null,
  distanceMeters: number,
) {
  if (elapsedTimeSeconds == null || distanceMeters <= 0) {
    return null;
  }

  return elapsedTimeSeconds / (distanceMeters / 1000);
}

export function buildActivityCalendar(
  input: ActivityCalendarQueryInput,
  records: CalendarActivityRecord[],
): ActivityCalendarData {
  const from = new Date(input.from);
  const to = new Date(input.to);
  const activities = [...records]
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
    .map((record) => ({
      id: record.id,
      name:
        typeof record.name === "string" && record.name.trim().length > 0
          ? record.name
          : untitledActivityName,
      startDate: record.startDate.toISOString(),
      elapsedTime: record.elapsedTime,
      distance: record.distance,
      averagePaceSecondsPerKm: calculateAveragePaceSecondsPerKm(
        record.elapsedTime,
        record.distance,
      ),
      averageHeartrate: record.averageHeartrate,
      trainingLoad: record.trainingLoad,
      totalElevationGain: record.totalElevationGain,
    }));

  const weekSummaries = createWeekSummaries(from, to, input.timezone);
  const summariesByWeekStart = new Map(
    weekSummaries.map((summary) => [summary.weekStart, summary]),
  );

  for (const record of records) {
    const localDate =
      record.summaryDate ?? getLocalDateKey(record.startDate, input.timezone);
    const weekStart = startOfWeekKey(localDate);
    const summary = summariesByWeekStart.get(weekStart);

    if (!summary) {
      continue;
    }

    summary.time += record.elapsedTime ?? 0;
    summary.distance += record.distance;
    summary.totalElevationGain += record.totalElevationGain ?? 0;

    if (record.elapsedTime != null && record.distance > 0) {
      summary.paceElapsedTimeSeconds += record.elapsedTime;
      summary.paceDistanceMeters += record.distance;
    }
  }

  return {
    activities,
    weeks: weekSummaries.map((summary) => ({
      weekStart: summary.weekStart,
      weekEnd: summary.weekEnd,
      time: summary.time,
      distance: summary.distance,
      totalElevationGain: summary.totalElevationGain,
      averagePaceSecondsPerKm:
        summary.paceDistanceMeters > 0
          ? summary.paceElapsedTimeSeconds / (summary.paceDistanceMeters / 1000)
          : null,
    })),
  };
}

function createWeekSummaries(from: Date, to: Date, timezone: string) {
  const firstDateKey = getLocalDateKey(from, timezone);
  const lastIncludedDateKey = getLocalDateKey(
    new Date(to.getTime() - 1),
    timezone,
  );
  const firstWeekStart = startOfWeekKey(firstDateKey);
  const lastWeekStart = startOfWeekKey(lastIncludedDateKey);
  const summaries: MutableWeekSummary[] = [];

  for (
    let currentWeekStart = firstWeekStart;
    compareDateKeys(currentWeekStart, lastWeekStart) <= 0;
    currentWeekStart = addDaysToDateKey(currentWeekStart, 7)
  ) {
    summaries.push({
      weekStart: currentWeekStart,
      weekEnd: addDaysToDateKey(currentWeekStart, 6),
      time: 0,
      distance: 0,
      totalElevationGain: 0,
      averagePaceSecondsPerKm: null,
      paceDistanceMeters: 0,
      paceElapsedTimeSeconds: 0,
    });
  }

  return summaries;
}

export function getLocalDateKey(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to derive calendar date");
  }

  return `${year}-${month}-${day}`;
}

function startOfWeekKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;

  return addDaysToDateKey(dateKey, -daysFromMonday);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compareDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}
