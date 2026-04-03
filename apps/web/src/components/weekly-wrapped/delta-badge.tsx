import {
  formatDistanceToKm,
  formatSecondsToMinsPerKm,
} from "@/components/activities/utils/formatters";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

function DeltaBadge({
  value,
  unit,
  invert = false,
}: {
  value: number;
  unit: string;
  invert?: boolean;
}) {
  const isPositive = invert ? value < 0 : value > 0;
  const isNeutral = value === 0;

  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-medium ${
        isNeutral
          ? "text-zinc-400"
          : isPositive
            ? "text-emerald-400"
            : "text-orange-400"
      }`}
    >
      {!isNeutral &&
        (isPositive ? (
          <ArrowUpIcon className="size-3.5" />
        ) : (
          <ArrowDownIcon className="size-3.5" />
        ))}
      {value > 0 ? "+" : ""}
      {unit === "/km"
        ? formatSecondsToMinsPerKm(Math.abs(value))
        : unit === "km"
          ? formatDistanceToKm(Math.abs(value))
          : Math.abs(value)}
      <span className="text-muted-foreground">vs last week</span>
    </span>
  );
}

export { DeltaBadge };
