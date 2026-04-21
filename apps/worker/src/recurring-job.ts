type Logger = Pick<typeof console, "error" | "info">;

export type RecurringJob = {
  name: string;
  getWindowKey: (now: Date) => string | null;
  run: () => Promise<unknown>;
};

export function createRecurringJob(
  job: RecurringJob,
  logger: Logger = console,
) {
  let lastWindowKey: string | null = null;
  let inFlight = false;

  const tick = async (now = new Date()) => {
    const windowKey = job.getWindowKey(now);

    if (!windowKey || windowKey === lastWindowKey || inFlight) {
      return false;
    }

    lastWindowKey = windowKey;
    inFlight = true;
    logger.info(`[worker] starting ${job.name} for ${windowKey}:00Z`);

    try {
      await job.run();
      logger.info(`[worker] finished ${job.name} for ${windowKey}:00Z`);
    } catch (error) {
      logger.error(
        `[worker] ${job.name} failed for ${windowKey}:00Z: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      inFlight = false;
    }

    return true;
  };

  const start = (pollIntervalMs = 60_000) => {
    void tick();
    const handle = setInterval(() => {
      void tick();
    }, pollIntervalMs);

    return () => {
      clearInterval(handle);
    };
  };

  return {
    tick,
    start,
  };
}
