import { env } from "@corex/env/server";

import { startWorker } from "./worker";

void env.NODE_ENV;

const stopWorker = startWorker();

function shutdown(signal: string) {
  console.info(`[worker] received ${signal}, shutting down`);
  stopWorker();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
