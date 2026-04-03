import { DISTANCE_CONFIG } from "@/components/activities/utils/best-efforts";

export function getDistanceConfig(distanceMeters: number) {
  return (
    DISTANCE_CONFIG[distanceMeters as keyof typeof DISTANCE_CONFIG] ?? {
      short: formatFallbackDistanceLabel(distanceMeters),
      long: formatFallbackDistanceLabel(distanceMeters),
      color: "#475569",
      ring: "#94a3b8",
      glow: "rgba(148,163,184,0.3)",
    }
  );
}

export function getDistanceLabel(distanceMeters: number) {
  return getDistanceConfig(distanceMeters).short;
}

function formatFallbackDistanceLabel(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(distanceMeters % 1000 === 0 ? 0 : 1)}K`;
  }

  return `${Math.round(distanceMeters)}m`;
}
