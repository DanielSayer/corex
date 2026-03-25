import { db, type Database } from "@corex/db";

import { createDerivedPerformanceRepository } from "./derived-performance-repository";
import {
  createDerivedPerformanceService,
  type DerivedPerformanceService,
} from "./derived-performance-service";

export function createLiveDerivedPerformanceService(
  options: {
    db?: Database;
  } = {},
): DerivedPerformanceService {
  const database = options.db ?? db;

  return createDerivedPerformanceService({
    repo: createDerivedPerformanceRepository(database),
  });
}
