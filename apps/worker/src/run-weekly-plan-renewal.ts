import { env } from "@corex/env/server";

import { logJobFailure, runWeeklyPlanRenewalJob } from "./jobs";

void env.NODE_ENV;

try {
  await runWeeklyPlanRenewalJob();
} catch (error) {
  logJobFailure("weekly-plan-renewal", error);
  process.exitCode = 1;
}
