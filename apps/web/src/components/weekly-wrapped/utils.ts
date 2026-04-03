export const WEEKLY_WRAPPED_STAGGER_CHILD = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function formatWeekRange(start: string, end: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).formatRange(new Date(start), new Date(end));
}

export function formatNumericValue(
  value: number | null,
  unit: string | null,
  options: { compact?: boolean } = {},
) {
  if (value == null) {
    return "Snapshot saved";
  }

  const rendered =
    options.compact && Number.isInteger(value)
      ? value.toString()
      : value.toFixed(1);
  const normalized = rendered.endsWith(".0") ? rendered.slice(0, -2) : rendered;

  return unit ? `${normalized} ${unit}` : normalized;
}

export function formatGeneratedAt(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
