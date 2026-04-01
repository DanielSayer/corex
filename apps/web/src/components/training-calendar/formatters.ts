import { EMPTY_VALUE } from "@/components/activities/utils/formatters";

export function formatCalendarDuration(totalSeconds: number | null) {
  if (!totalSeconds || totalSeconds <= 0) {
    return EMPTY_VALUE;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
