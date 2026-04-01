import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import type {
  CreateIntervalsSyncModuleOptions,
  IntervalsSyncApi,
} from "./module-types";
import {
  DEFAULT_DETAIL_CONCURRENCY,
  DEFAULT_INCREMENTAL_OVERLAP_HOURS,
  DEFAULT_INITIAL_WINDOW_DAYS,
  REQUESTED_STREAM_TYPES,
} from "./sync-policy";
import { runIntervalsSyncNow } from "./sync-workflow";

export { REQUESTED_STREAM_TYPES } from "./sync-policy";
export type {
  CreateIntervalsSyncModuleOptions,
  IntervalsSyncApi,
  IntervalsSyncPolicy,
} from "./module-types";

export function createIntervalsSyncModule(
  options: CreateIntervalsSyncModuleOptions,
): IntervalsSyncApi {
  const clock = options.clock ?? { now: () => new Date() };
  const idGenerator = options.idGenerator ?? randomUUID;
  const initialWindowDays =
    options.policy?.initialWindowDays ?? DEFAULT_INITIAL_WINDOW_DAYS;
  const overlapHours =
    options.policy?.overlapHours ?? DEFAULT_INCREMENTAL_OVERLAP_HOURS;
  const detailConcurrency =
    options.policy?.detailConcurrency ?? DEFAULT_DETAIL_CONCURRENCY;
  const requestedStreamTypes = [
    ...(options.policy?.requestedStreamTypes ?? REQUESTED_STREAM_TYPES),
  ];

  return {
    latest(userId) {
      return options.ledger.latest(userId);
    },
    syncNow(userId) {
      return Effect.suspend(() =>
        runIntervalsSyncNow(
          options,
          {
            clock,
            idGenerator,
            initialWindowDays,
            overlapHours,
            detailConcurrency,
            requestedStreamTypes,
          },
          userId,
        ),
      );
    },
  };
}
