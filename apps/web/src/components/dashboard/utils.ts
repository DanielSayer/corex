export function toSvgPath(
  latlngs: Array<number[] | null> | null | undefined,
  width = 320,
  height = 88,
) {
  const points = (latlngs ?? [])
    .filter(
      (point): point is number[] => Array.isArray(point) && point.length >= 2,
    )
    .map(([lat, lng]) => ({ lat, lng }));

  if (points.length < 2) {
    return null;
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  const latRange = maxLat - minLat || 0.000001;
  const lngRange = maxLng - minLng || 0.000001;
  const pad = 6;
  const drawWidth = width - pad * 2;
  const drawHeight = height - pad * 2;
  const scale = Math.min(drawWidth / lngRange, drawHeight / latRange);
  const offsetX = pad + (drawWidth - lngRange * scale) / 2;
  const offsetY = pad + (drawHeight - latRange * scale) / 2;

  return points
    .map((point, index) => {
      const x = (point.lng - minLng) * scale + offsetX;
      const y = drawHeight - (point.lat - minLat) * scale + offsetY;

      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function formatActivityDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(seconds: number | null) {
  if (seconds == null || seconds <= 0) {
    return "N/A";
  }

  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value, index) =>
      index === 0 ? String(value) : String(value).padStart(2, "0"),
    )
    .join(":");
}

export function formatDistance(meters: number | null) {
  if (meters == null || meters <= 0) {
    return "N/A";
  }

  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatHeartRate(value: number | null) {
  if (value == null || value <= 0) {
    return "N/A";
  }

  return `${Math.round(value)} bpm`;
}
