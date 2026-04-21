import {
  getWeeklyPlanRenewalWindowKey,
  getWeeklySnapshotsWindowKey,
} from "./schedule";
import { createRecurringJob } from "./recurring-job";
import { runWeeklyPlanRenewalJob, runWeeklySnapshotsJob } from "./jobs";

type Logger = Pick<typeof console, "error" | "info">;

export function startWorker(logger: Logger = console) {
  logger.info("[worker] starting background jobs");

  const stopWeeklySnapshots = createRecurringJob(
    {
      name: "weekly-snapshots",
      getWindowKey: getWeeklySnapshotsWindowKey,
      run: () => runWeeklySnapshotsJob(logger),
    },
    logger,
  ).start();

  const stopWeeklyPlanRenewal = createRecurringJob(
    {
      name: "weekly-plan-renewal",
      getWindowKey: getWeeklyPlanRenewalWindowKey,
      run: () => runWeeklyPlanRenewalJob(logger),
    },
    logger,
  ).start();

  return () => {
    stopWeeklySnapshots();
    stopWeeklyPlanRenewal();
    logger.info("[worker] stopped background jobs");
  };
}
