const TEMPO_KEYWORDS = ["tempo", "threshold", "cruise"];
const INTERVAL_KEYWORDS = [
  "interval",
  "intervals",
  "rep",
  "reps",
  "repeat",
  "track",
  "fartlek",
];
const LONG_RUN_KEYWORDS = ["long run", "longrun"];

export type AnalyticsTrainingMixKey =
  | "easy"
  | "long_run"
  | "tempo"
  | "intervals";

type ClassifyTrainingMixActivityInput = {
  name: string | null;
  intervalSummary: string[] | null | undefined;
  workIntervalCount: number;
};

type TrainingMixEntry = {
  key: AnalyticsTrainingMixKey;
  distanceMeters: number;
};

function normalizeText(input: string | null | undefined) {
  return input?.trim().toLowerCase() ?? "";
}

function matchesAnyKeyword(haystack: string, keywords: string[]) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function buildSearchText(input: ClassifyTrainingMixActivityInput) {
  return [input.name, ...(input.intervalSummary ?? [])]
    .map((value) => normalizeText(value))
    .filter((value) => value.length > 0)
    .join(" ");
}

export function classifyTrainingMixActivity(
  input: ClassifyTrainingMixActivityInput,
): AnalyticsTrainingMixKey {
  const searchText = buildSearchText(input);

  if (matchesAnyKeyword(searchText, TEMPO_KEYWORDS)) {
    return "tempo";
  }

  if (
    matchesAnyKeyword(searchText, INTERVAL_KEYWORDS) ||
    input.workIntervalCount >= 2
  ) {
    return "intervals";
  }

  if (matchesAnyKeyword(searchText, LONG_RUN_KEYWORDS)) {
    return "long_run";
  }

  return "easy";
}

export function summarizeTrainingMix(entries: TrainingMixEntry[]) {
  const totalDistanceMeters = entries.reduce(
    (sum, entry) => sum + entry.distanceMeters,
    0,
  );
  const buckets: AnalyticsTrainingMixKey[] = [
    "easy",
    "long_run",
    "tempo",
    "intervals",
  ];

  return {
    totalDistanceMeters,
    buckets: buckets.map((key) => {
      const bucketEntries = entries.filter((entry) => entry.key === key);
      const distanceMeters = bucketEntries.reduce(
        (sum, entry) => sum + entry.distanceMeters,
        0,
      );

      return {
        key,
        distanceMeters,
        runCount: bucketEntries.length,
        sharePercent:
          totalDistanceMeters > 0
            ? (distanceMeters / totalDistanceMeters) * 100
            : 0,
      };
    }),
  };
}
