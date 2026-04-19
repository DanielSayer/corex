import { formatSecondsToMinsPerKm } from "./utils/formatters";

type SplitsChartProps = {
  splits: Array<{
    durationSeconds: number;
    splitDistanceMeters: number;
    splitNumber: number;
  }>;
};

type SplitChartRow = SplitsChartProps["splits"][number] & {
  distanceKm: number;
  paceSecondsPerKm: number;
};

function formatDiff(diffSeconds: number) {
  const abs = Math.round(Math.abs(diffSeconds));
  const minutes = Math.floor(abs / 60);
  const seconds = abs % 60;
  const sign = diffSeconds > 0 ? "+" : "-";

  return `${sign}${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function buildSplitChartRows(
  splits: SplitsChartProps["splits"],
): SplitChartRow[] {
  let previousDistanceMeters = 0;

  return splits.map((split) => {
    const splitDistanceMeters = Math.max(
      split.splitDistanceMeters - previousDistanceMeters,
      0,
    );
    previousDistanceMeters = split.splitDistanceMeters;

    const distanceKm = splitDistanceMeters / 1000;
    const paceSecondsPerKm =
      distanceKm > 0 ? split.durationSeconds / distanceKm : 0;

    return {
      ...split,
      distanceKm,
      paceSecondsPerKm,
    };
  });
}

function SplitsChart({ splits }: SplitsChartProps) {
  if (splits.length === 0) {
    return null;
  }

  const splitsWithPace = buildSplitChartRows(splits);

  const minPace = Math.min(
    ...splitsWithPace.map((split) => split.paceSecondsPerKm),
  );
  const maxPace = Math.max(
    ...splitsWithPace.map((split) => split.paceSecondsPerKm),
  );
  const paceRange = maxPace - minPace || 1;
  const getBarWidth = (pace: number) =>
    88 - ((pace - minPace) / paceRange) * 46;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Splits</h2>
        <p className="text-muted-foreground text-sm">Your 1 km splits.</p>
      </div>

      <div className="space-y-3 p-5">
        <div className="text-muted-foreground grid grid-cols-[3.5rem_1fr_4.5rem] items-center pb-1 text-xs font-semibold tracking-widest uppercase">
          <span>KM</span>
          <span>AVG PACE</span>
          <span className="text-right">+/-</span>
        </div>

        {splitsWithPace.map((split, index) => {
          const previous = index > 0 ? splitsWithPace[index - 1] : null;
          const diff =
            previous !== null
              ? previous.paceSecondsPerKm - split.paceSecondsPerKm
              : null;
          const barWidth = getBarWidth(split.paceSecondsPerKm);

          return (
            <div
              key={split.splitNumber}
              className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center"
            >
              <span className="text-foreground text-sm">
                {split.splitNumber}
              </span>

              <div className="pr-3">
                <div
                  className="bg-primary text-primary-foreground flex min-w-28 items-center rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                >
                  {formatSecondsToMinsPerKm(split.paceSecondsPerKm)}
                </div>
              </div>

              <span
                className={`text-right text-sm font-semibold ${
                  diff === null
                    ? "invisible"
                    : diff > 0
                      ? "text-green-400"
                      : "text-red-400"
                }`}
              >
                {diff !== null ? formatDiff(diff) : "0:00"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { buildSplitChartRows, formatDiff, SplitsChart };
