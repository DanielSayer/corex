import type { IntervalsActivityStream } from "./schemas";

function normalizeCadenceStreamData(data: unknown) {
  if (!Array.isArray(data)) {
    return data;
  }

  return data.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value * 2 : value,
  );
}

export function normalizeActivityStreamForStorage(
  stream: IntervalsActivityStream,
): IntervalsActivityStream {
  if (stream.type !== "cadence") {
    return stream;
  }

  return {
    ...stream,
    data: normalizeCadenceStreamData(stream.data),
  };
}
