const BEST_EFFORT_TARGET_DISTANCES_METERS = [
  400, 1000, 1609.344, 5000, 10000, 21097.5, 42195,
] as const;

export type BestEffortDistance =
  (typeof BEST_EFFORT_TARGET_DISTANCES_METERS)[number];

const DISTANCE_CONFIG: Record<
  BestEffortDistance,
  {
    short: string;
    long: string;
    color: string;
    ring: string;
    glow: string;
  }
> = {
  400: {
    short: "400m",
    long: "400 Meters",
    color: "#6b7280",
    ring: "#9ca3af",
    glow: "rgba(156,163,175,0.3)",
  },
  1000: {
    short: "1K",
    long: "1 Kilometer",
    color: "#475569",
    ring: "#94a3b8",
    glow: "rgba(148,163,184,0.3)",
  },
  1609.344: {
    short: "1MI",
    long: "1 Mile",
    color: "#92400e",
    ring: "#f59e0b",
    glow: "rgba(245,158,11,0.3)",
  },
  5000: {
    short: "5K",
    long: "5 Kilometers",
    color: "#1e40af",
    ring: "#60a5fa",
    glow: "rgba(96,165,250,0.3)",
  },
  10000: {
    short: "10K",
    long: "10 Kilometers",
    color: "#065f46",
    ring: "#34d399",
    glow: "rgba(52,211,153,0.3)",
  },
  21097.5: {
    short: "HM",
    long: "Half Marathon",
    color: "#5b21b6",
    ring: "#a78bfa",
    glow: "rgba(167,139,250,0.3)",
  },
  42195: {
    short: "FM",
    long: "Full Marathon",
    color: "#7f1d1d",
    ring: "#f87171",
    glow: "rgba(248,113,113,0.3)",
  },
};

export { BEST_EFFORT_TARGET_DISTANCES_METERS, DISTANCE_CONFIG };
