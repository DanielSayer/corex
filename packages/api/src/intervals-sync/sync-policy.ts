import type { SyncWindow } from "./module-types";

export const DEFAULT_INITIAL_WINDOW_DAYS = 30;
export const DEFAULT_INCREMENTAL_OVERLAP_HOURS = 24;
export const DEFAULT_DETAIL_CONCURRENCY = 4;
export const REQUESTED_STREAM_TYPES = [
  "cadence",
  "heartrate",
  "distance",
  "velocity_smooth",
  "fixed_altitude",
] as const;

export function computeSyncWindow(
  now: Date,
  latestCursor: Date | null,
  initialWindowDays: number,
  overlapHours: number,
): SyncWindow {
  if (!latestCursor) {
    const cursorStartUsed = new Date(now);
    cursorStartUsed.setUTCDate(
      cursorStartUsed.getUTCDate() - initialWindowDays,
    );

    return {
      historyCoverage: "initial_30d_window",
      cursorStartUsed,
    };
  }

  const cursorStartUsed = new Date(latestCursor);
  cursorStartUsed.setUTCHours(cursorStartUsed.getUTCHours() - overlapHours);

  return {
    historyCoverage: "incremental_from_cursor",
    cursorStartUsed,
  };
}

export function toIntervalsDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
