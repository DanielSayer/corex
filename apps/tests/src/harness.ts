import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

import { createDb, type Database } from "@corex/db";
import { getServerTestEnv, installServerTestEnv } from "@corex/env/test";

const execFileAsync = promisify(execFile);
const containerLabel = "corex.integration-harness=true";
const containerOwnerLabel = "corex.integration-owner-pid";
const containerOwnerLabelValue = String(process.pid);
const signalExitCodeByName = {
  SIGINT: 130,
  SIGTERM: 143,
  SIGBREAK: 149,
} as const;

type IntegrationContainer = {
  stop: () => Promise<void>;
};

type IntegrationHarness = {
  databaseUrl: string;
  db: Database;
  container: IntegrationContainer;
};

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const migrationsFolder = path.join(rootDir, "packages/db/src/migrations");
const externalDatabaseEnvKey = "COREX_INTEGRATION_EXTERNAL_DATABASE";
const legacyContainerNamePrefix = "corex-test-";

let harnessPromise: Promise<IntegrationHarness> | undefined;
let harnessError: Error | undefined;
let cleanupHandlersRegistered = false;
let shutdownPromise: Promise<void> | undefined;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDockerCommand(args: string[]) {
  const { stdout } = await execFileAsync("docker", args, {
    cwd: rootDir,
  });

  return stdout.trim();
}

function createContainerName() {
  return `corex-test-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function listHarnessContainerIds() {
  const containerIds = await runDockerCommand([
    "ps",
    "--all",
    "--quiet",
    "--filter",
    `label=${containerLabel}`,
  ]);

  if (!containerIds) {
    return [];
  }

  return containerIds.split(/\s+/);
}

async function listLegacyHarnessContainerIds() {
  const containerIds = await runDockerCommand([
    "ps",
    "--all",
    "--quiet",
    "--filter",
    `name=${legacyContainerNamePrefix}`,
  ]);

  if (!containerIds) {
    return [];
  }

  return containerIds.split(/\s+/);
}

async function removeContainer(containerId: string) {
  await runDockerCommand(["rm", "--force", containerId]);
}

async function readContainerOwnerPid(containerId: string) {
  const ownerPid = await runDockerCommand([
    "inspect",
    "--format",
    `{{ index .Config.Labels "${containerOwnerLabel}" }}`,
    containerId,
  ]);

  return Number.parseInt(ownerPid, 10);
}

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error
      ? error.code !== "ESRCH"
      : false;
  }
}

async function removeCurrentProcessHarnessContainers() {
  const containerIds = await listHarnessContainerIds();

  for (const containerId of containerIds) {
    const ownerPid = await readContainerOwnerPid(containerId).catch(() => NaN);

    if (ownerPid === process.pid) {
      await removeContainer(containerId).catch(() => undefined);
    }
  }
}

async function removeStaleHarnessContainers() {
  const containerIds = await listHarnessContainerIds();

  for (const containerId of containerIds) {
    const ownerPid = await readContainerOwnerPid(containerId).catch(() => NaN);

    if (!isProcessAlive(ownerPid)) {
      await removeContainer(containerId).catch(() => undefined);
    }
  }
}

async function removeLegacyHarnessContainers() {
  const containerIds = await listLegacyHarnessContainerIds();

  for (const containerId of containerIds) {
    await removeContainer(containerId).catch(() => undefined);
  }
}

function registerCleanupHandlers() {
  if (cleanupHandlersRegistered) {
    return;
  }

  cleanupHandlersRegistered = true;

  const cleanup = () => {
    shutdownPromise ??= stopIntegrationHarness();
    return shutdownPromise;
  };

  const handleSignal = (signal: keyof typeof signalExitCodeByName) => {
    void cleanup().finally(() => {
      process.exit(signalExitCodeByName[signal]);
    });
  };

  process.once("beforeExit", () => cleanup());
  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));
  process.once("SIGBREAK", () => handleSignal("SIGBREAK"));
  process.once("uncaughtException", (error) => {
    void cleanup().finally(() => {
      process.nextTick(() => {
        throw error;
      });
    });
  });
  process.once("unhandledRejection", (reason) => {
    void cleanup().finally(() => {
      process.nextTick(() => {
        throw reason;
      });
    });
  });
}

async function waitForPostgres(databaseUrl: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const client = new Client({
      connectionString: databaseUrl,
    });

    try {
      await client.connect();
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await delay(1_000);
    }
  }

  throw new Error(
    `Postgres did not become ready in time. ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function startDockerPostgres(): Promise<{
  container: IntegrationContainer;
  databaseUrl: string;
}> {
  await removeStaleHarnessContainers();

  const containerName = createContainerName();

  await runDockerCommand([
    "run",
    "--detach",
    "--label",
    containerLabel,
    "--label",
    `${containerOwnerLabel}=${containerOwnerLabelValue}`,
    "--publish-all",
    "--name",
    containerName,
    "--env",
    "POSTGRES_DB=corex_test",
    "--env",
    "POSTGRES_USER=postgres",
    "--env",
    "POSTGRES_PASSWORD=password",
    "postgres:16-alpine",
  ]);

  try {
    const portOutput = await runDockerCommand([
      "port",
      containerName,
      "5432/tcp",
    ]);
    const portMatch = portOutput.match(/:(\d+)\s*$/);

    if (!portMatch) {
      throw new Error(
        `Could not determine mapped Postgres port from: ${portOutput}`,
      );
    }

    const databaseUrl = `postgres://postgres:password@127.0.0.1:${portMatch[1]}/corex_test`;
    await waitForPostgres(databaseUrl);

    return {
      databaseUrl,
      container: {
        async stop() {
          await runDockerCommand(["rm", "--force", containerName]);
        },
      },
    };
  } catch (error) {
    await runDockerCommand(["rm", "--force", containerName]).catch(
      () => undefined,
    );
    throw error;
  }
}

function setIntegrationEnv(databaseUrl: string) {
  installServerTestEnv(
    {
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl,
    },
    { overwrite: true },
  );
}

function isExternalDatabaseManaged() {
  return Bun.env[externalDatabaseEnvKey] === "1";
}

export async function startIntegrationHarness() {
  if (harnessError) {
    throw harnessError;
  }

  if (!harnessPromise) {
    registerCleanupHandlers();
    harnessPromise = (async () => {
      try {
        if (isExternalDatabaseManaged()) {
          const databaseUrl = getServerTestEnv().DATABASE_URL;

          return {
            container: {
              async stop() {},
            },
            databaseUrl,
            db: createDb(databaseUrl),
          };
        }

        const { container, databaseUrl } = await startDockerPostgres();
        setIntegrationEnv(databaseUrl);

        const db = createDb(databaseUrl);
        await migrate(db, {
          migrationsFolder,
        });

        return {
          container,
          databaseUrl,
          db,
        };
      } catch (error) {
        harnessPromise = undefined;
        harnessError = new Error(
          [
            "Integration harness startup failed.",
            "Docker is required and must be reachable from Bun so the test harness can start Postgres.",
            error instanceof Error ? error.message : String(error),
          ].join(" "),
        );
        throw harnessError;
      }
    })();
  }

  return harnessPromise;
}

export async function getIntegrationHarness() {
  const harness = await startIntegrationHarness();

  if (getServerTestEnv().DATABASE_URL !== harness.databaseUrl) {
    setIntegrationEnv(harness.databaseUrl);
  }

  return harness;
}

export async function resetDatabase() {
  const { db } = await getIntegrationHarness();
  const tableResult = await db.execute(sql`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename != '__drizzle_migrations'
  `);

  const tableNames = tableResult.rows
    .map((row) => row.tablename)
    .filter((value): value is string => typeof value === "string");

  if (tableNames.length === 0) {
    return;
  }

  const quotedTableNames = tableNames
    .map((tableName) => `"${tableName}"`)
    .join(", ");
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${quotedTableNames} RESTART IDENTITY CASCADE`),
  );
}

export async function stopIntegrationHarness() {
  harnessError = undefined;

  if (!harnessPromise) {
    await removeCurrentProcessHarnessContainers().catch(() => undefined);
    await removeLegacyHarnessContainers().catch(() => undefined);
    shutdownPromise = undefined;
    return;
  }

  const { container, db } = await harnessPromise;
  harnessPromise = undefined;
  await db.$client.end().catch(() => undefined);
  await container.stop().catch(() => undefined);
  await removeCurrentProcessHarnessContainers().catch(() => undefined);
  await removeLegacyHarnessContainers().catch(() => undefined);
  shutdownPromise = undefined;
}
