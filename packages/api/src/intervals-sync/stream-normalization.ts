import type { IntervalsActivityStream } from "../integrations/intervals-icu/schemas";

function normalizeCadenceStreamData(
  data: IntervalsActivityStream["data"],
): IntervalsActivityStream["data"] {
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
