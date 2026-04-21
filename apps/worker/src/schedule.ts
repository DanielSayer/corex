export function getHourlyUtcWindowKey(now: Date, minuteOffset: number) {
  if (minuteOffset < 0 || minuteOffset > 59) {
    throw new Error("minuteOffset must be between 0 and 59");
  }

  if (now.getUTCMinutes() < minuteOffset) {
    return null;
  }

  return now.toISOString().slice(0, 13);
}

export function getWeeklySnapshotsWindowKey(now: Date) {
  return getHourlyUtcWindowKey(now, 5);
}

export function getWeeklyPlanRenewalWindowKey(now: Date) {
  return getHourlyUtcWindowKey(now, 35);
}
