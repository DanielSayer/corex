export const TERRAIN_CLASSES = {
  flat: "flat",
  rolling: "rolling",
  hilly: "hilly",
} as const;

export const ORDERED_TERRAIN_CLASSES = [
  TERRAIN_CLASSES.flat,
  TERRAIN_CLASSES.rolling,
  TERRAIN_CLASSES.hilly,
] as const;

export type TerrainClass =
  (typeof TERRAIN_CLASSES)[keyof typeof TERRAIN_CLASSES];

export type TerrainRunInput = {
  distanceMeters: number | null;
  elevationGainMeters: number | null;
};

export type TerrainRunSummary = {
  terrainClass: TerrainClass | null;
  elevationGainMetersPerKm: number | null;
};

export type TerrainClassSummary = {
  terrainClass: TerrainClass;
  runCount: number;
  distanceMeters: number;
  elevationGainMeters: number;
  averageElevationGainMetersPerKm: number | null;
};

export type TerrainSummary = {
  totalRunCount: number;
  classifiedRunCount: number;
  unclassifiedRunCount: number;
  classifiedDistanceMeters: number;
  classifiedElevationGainMeters: number;
  averageElevationGainMetersPerKm: number | null;
  dominantClass: TerrainClass | null;
  classes: TerrainClassSummary[];
};

function isUsableTerrainNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function buildEmptyClassSummary(
  terrainClass: TerrainClass,
): TerrainClassSummary {
  return {
    terrainClass,
    runCount: 0,
    distanceMeters: 0,
    elevationGainMeters: 0,
    averageElevationGainMetersPerKm: null,
  };
}

export function deriveTerrainRun(input: TerrainRunInput): TerrainRunSummary {
  const { distanceMeters, elevationGainMeters } = input;

  if (
    !isUsableTerrainNumber(distanceMeters) ||
    !isUsableTerrainNumber(elevationGainMeters) ||
    distanceMeters <= 0
  ) {
    return {
      terrainClass: null,
      elevationGainMetersPerKm: null,
    };
  }

  const elevationGainMetersPerKm =
    elevationGainMeters / (distanceMeters / 1000);

  if (elevationGainMetersPerKm < 5) {
    return {
      terrainClass: TERRAIN_CLASSES.flat,
      elevationGainMetersPerKm,
    };
  }

  if (elevationGainMetersPerKm <= 15) {
    return {
      terrainClass: TERRAIN_CLASSES.rolling,
      elevationGainMetersPerKm,
    };
  }

  return {
    terrainClass: TERRAIN_CLASSES.hilly,
    elevationGainMetersPerKm,
  };
}

export function deriveTerrainClass(input: TerrainRunInput) {
  return deriveTerrainRun(input).terrainClass;
}

export function aggregateTerrainSummary(
  runs: TerrainRunInput[],
): TerrainSummary {
  const summariesByClass = new Map<TerrainClass, TerrainClassSummary>(
    ORDERED_TERRAIN_CLASSES.map((terrainClass) => [
      terrainClass,
      buildEmptyClassSummary(terrainClass),
    ]),
  );
  let unclassifiedRunCount = 0;

  for (const run of runs) {
    const terrain = deriveTerrainRun(run);

    if (!terrain.terrainClass) {
      unclassifiedRunCount += 1;
      continue;
    }

    const summary = summariesByClass.get(terrain.terrainClass);

    if (
      !summary ||
      run.distanceMeters == null ||
      run.elevationGainMeters == null
    ) {
      unclassifiedRunCount += 1;
      continue;
    }

    summary.runCount += 1;
    summary.distanceMeters += run.distanceMeters;
    summary.elevationGainMeters += run.elevationGainMeters;
  }

  const classes = ORDERED_TERRAIN_CLASSES.map((terrainClass) => {
    const summary =
      summariesByClass.get(terrainClass) ??
      buildEmptyClassSummary(terrainClass);

    return {
      ...summary,
      averageElevationGainMetersPerKm:
        summary.distanceMeters > 0
          ? summary.elevationGainMeters / (summary.distanceMeters / 1000)
          : null,
    };
  });
  const classifiedRunCount = classes.reduce(
    (sum, summary) => sum + summary.runCount,
    0,
  );
  const classifiedDistanceMeters = classes.reduce(
    (sum, summary) => sum + summary.distanceMeters,
    0,
  );
  const classifiedElevationGainMeters = classes.reduce(
    (sum, summary) => sum + summary.elevationGainMeters,
    0,
  );
  const dominantClass =
    classes
      .filter((summary) => summary.runCount > 0)
      .sort(
        (left, right) =>
          right.runCount - left.runCount ||
          right.distanceMeters - left.distanceMeters,
      )[0]?.terrainClass ?? null;

  return {
    totalRunCount: runs.length,
    classifiedRunCount,
    unclassifiedRunCount,
    classifiedDistanceMeters,
    classifiedElevationGainMeters,
    averageElevationGainMetersPerKm:
      classifiedDistanceMeters > 0
        ? classifiedElevationGainMeters / (classifiedDistanceMeters / 1000)
        : null,
    dominantClass,
    classes,
  };
}
