export type OffsetPaginationInput = {
  limit: number;
  offset: number;
};

export type OffsetPaginationPage<T> = {
  items: T[];
  nextOffset: number | null;
};

export function toOffsetPaginationQuery(input: OffsetPaginationInput) {
  return {
    limit: input.limit + 1,
    offset: input.offset,
  };
}

export function paginateOffsetResults<T>(
  rows: T[],
  input: OffsetPaginationInput,
): OffsetPaginationPage<T> {
  return {
    items: rows.slice(0, input.limit),
    nextOffset: rows.length > input.limit ? input.offset + input.limit : null,
  };
}
