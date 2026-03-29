const EMPTY_VALUE = "--";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "Unknown date";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return dateTimeFormatter.format(date);
}

function formatDistanceToKm(
  meters: number | null,
  { showUnit = true }: { showUnit?: boolean } = {},
) {
  if (!meters || meters <= 0) {
    return EMPTY_VALUE;
  }

  return `${(meters / 1000).toFixed(2)}${showUnit ? " km" : ""}`;
}

function formatSpeedToMinsPerKm(speedMs: number | null) {
  if (!speedMs || speedMs <= 0) {
    return EMPTY_VALUE;
  }

  const secsPerKm = 1000 / speedMs;
  const mins = Math.floor(secsPerKm / 60);
  const secs = Math.round(secsPerKm % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatSpeedToKmPerHour(
  speedMs: number | null,
  { showUnit = true }: { showUnit?: boolean } = {},
) {
  if (!speedMs || speedMs <= 0) {
    return EMPTY_VALUE;
  }

  return `${(speedMs * 3.6).toFixed(2)}${showUnit ? " km/h" : ""}`;
}

function formatSecondsToMinsPerKm(
  totalSeconds: number | null,
  { showUnit = true }: { showUnit?: boolean } = {},
) {
  if (!totalSeconds || totalSeconds <= 0) {
    return EMPTY_VALUE;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}${showUnit ? "/km" : ""}`;
}

function formatSecondsToHms(
  totalSeconds: number | null,
  {
    showSeconds = true,
    showUnit = false,
  }: { showSeconds?: boolean; showUnit?: boolean } = {},
) {
  if (!totalSeconds || totalSeconds <= 0) {
    return EMPTY_VALUE;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);

  if (hours > 0) {
    if (showUnit) {
      return `${hours} hr ${minutes.toString().padStart(2, "0")} min${showSeconds ? ` ${seconds.toString().padStart(2, "0")} s` : ""}`;
    }

    return `${hours}:${minutes.toString().padStart(2, "0")}${showSeconds ? `:${seconds.toString().padStart(2, "0")}` : ""}`;
  }

  if (minutes > 0) {
    if (showUnit) {
      return `${minutes} min${showSeconds ? ` ${seconds.toString().padStart(2, "0")} s` : ""}`;
    }

    return `${minutes}${showSeconds ? `:${seconds.toString().padStart(2, "0")}` : ""}`;
  }

  if (showUnit) {
    return showSeconds ? `${seconds.toString().padStart(2, "0")} s` : "0";
  }

  return `0${showSeconds ? `:${seconds.toString().padStart(2, "0")}` : ""}`;
}

function formatPace(
  distanceMeters: number,
  durationSeconds: number,
  { showUnit = true }: { showUnit?: boolean } = {},
) {
  if (distanceMeters <= 0 || durationSeconds <= 0) {
    return EMPTY_VALUE;
  }

  const paceSecondsPerKm = durationSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.floor(paceSecondsPerKm % 60);

  return `${minutes}:${String(seconds).padStart(2, "0")}${showUnit ? "/km" : ""}`;
}

export {
  EMPTY_VALUE,
  formatDateTime,
  formatDistanceToKm,
  formatPace,
  formatSecondsToHms,
  formatSecondsToMinsPerKm,
  formatSpeedToKmPerHour,
  formatSpeedToMinsPerKm,
};
