import { env } from "@corex/env/server";

import { logJobFailure, runWeeklySnapshotsJob } from "./jobs";

void env.NODE_ENV;

try {
  await runWeeklySnapshotsJob();
} catch (error) {
  logJobFailure("weekly-snapshots", error);
  process.exitCode = 1;
}
