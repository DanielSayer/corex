export function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function getFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

export function getLocalDateKey(date: Date, timezone: string) {
  const parts = getFormatter(timezone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to derive local date");
  }

  return `${year}-${month}-${day}`;
}

function getTimeZoneOffsetMilliseconds(date: Date, timezone: string) {
  const parts = getFormatter(timezone).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const second = Number(parts.find((part) => part.type === "second")?.value);

  return Date.UTC(year, month - 1, day, hour, minute, second) - date.getTime();
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function compareDateKeys(left: string, right: string) {
  return left.localeCompare(right);
}

export function getDateKeyDiffInDays(left: string, right: string) {
  const leftDate = new Date(`${left}T00:00:00.000Z`);
  const rightDate = new Date(`${right}T00:00:00.000Z`);
  return Math.round(
    (rightDate.getTime() - leftDate.getTime()) / (24 * 60 * 60 * 1000),
  );
}

export function startOfWeekKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const dayOfWeek = date.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;

  return addDaysToDateKey(dateKey, -daysFromMonday);
}

export function startOfMonthKey(dateKey: string) {
  return `${dateKey.slice(0, 7)}-01`;
}

export function addMonthsToDateKey(dateKey: string, months: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  return date.toISOString().slice(0, 10);
}

export function localDateKeyToUtcStart(dateKey: string, timezone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const initialGuess = new Date(
    Date.UTC(year!, (month ?? 1) - 1, day!, 0, 0, 0),
  );
  const initialOffset = getTimeZoneOffsetMilliseconds(initialGuess, timezone);
  const corrected = new Date(initialGuess.getTime() - initialOffset);
  const correctedOffset = getTimeZoneOffsetMilliseconds(corrected, timezone);

  return new Date(initialGuess.getTime() - correctedOffset);
}

export function getLocalWeekRange(now: Date, timezone: string) {
  const currentDateKey = getLocalDateKey(now, timezone);
  const startKey = startOfWeekKey(currentDateKey);
  const endKey = addDaysToDateKey(startKey, 7);

  return {
    startKey,
    endKey,
    start: localDateKeyToUtcStart(startKey, timezone),
    end: localDateKeyToUtcStart(endKey, timezone),
  };
}

export function getLocalMonthRange(now: Date, timezone: string) {
  const currentDateKey = getLocalDateKey(now, timezone);
  const startKey = startOfMonthKey(currentDateKey);
  const endKey = addMonthsToDateKey(startKey, 1);

  return {
    startKey,
    endKey,
    start: localDateKeyToUtcStart(startKey, timezone),
    end: localDateKeyToUtcStart(endKey, timezone),
  };
}
