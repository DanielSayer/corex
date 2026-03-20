import path from "node:path";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";

import { createDb, type Database } from "@corex/db";

type IntegrationHarness = {
  databaseUrl: string;
  db: Database;
  container: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationsFolder = path.join(rootDir, "packages/db/src/migrations");

let harnessPromise: Promise<IntegrationHarness> | undefined;
let harnessError: Error | undefined;

function setIntegrationEnv(databaseUrl: string) {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.BETTER_AUTH_SECRET ??= "test-secret-value-with-32-characters";
  process.env.BETTER_AUTH_URL ??= "http://127.0.0.1:3000";
  process.env.CORS_ORIGIN ??= "http://127.0.0.1:3001";
}

export async function startIntegrationHarness() {
  if (harnessError) {
    throw harnessError;
  }

  if (!harnessPromise) {
    harnessPromise = (async () => {
      try {
        const container = await new PostgreSqlContainer("postgres:16-alpine")
          .withDatabase("corex_test")
          .withUsername("postgres")
          .withPassword("password")
          .start();

        const databaseUrl = container.getConnectionUri();
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
            "Bun/Testcontainers compatibility gate failed.",
            "Docker is required and Testcontainers must be reachable from Bun before DB-backed integration tests can run.",
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

  if (process.env.DATABASE_URL !== harness.databaseUrl) {
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

  const quotedTableNames = tableNames.map((tableName) => `"${tableName}"`).join(", ");
  await db.execute(sql.raw(`TRUNCATE TABLE ${quotedTableNames} RESTART IDENTITY CASCADE`));
}

export async function stopIntegrationHarness() {
  harnessError = undefined;

  if (!harnessPromise) {
    return;
  }

  const { container } = await harnessPromise;
  harnessPromise = undefined;
  await container.stop();
}
