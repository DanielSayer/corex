export const serverTestEnvDefaults = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://postgres:password@127.0.0.1:5432/corex_test",
  BETTER_AUTH_SECRET: "test-secret-value-with-32-characters",
  BETTER_AUTH_URL: "http://127.0.0.1:3000",
  CORS_ORIGIN: "http://127.0.0.1:3001",
  SETTINGS_MASTER_KEY_BASE64: Buffer.alloc(32, 1).toString("base64"),
  OPENAI_API_KEY: "test-openai-key",
  PLANNER_OPENAI_MODEL: "gpt-4.1-mini",
} as const;

type ServerTestEnvKey = keyof typeof serverTestEnvDefaults;
type ServerTestEnvOverrides = Partial<Record<ServerTestEnvKey, string>>;
type InstallServerTestEnvOptions = {
  overwrite?: boolean;
};

export function createServerTestEnv(overrides: ServerTestEnvOverrides = {}) {
  return {
    ...serverTestEnvDefaults,
    ...overrides,
  };
}

export type ServerTestEnv = ReturnType<typeof createServerTestEnv>;

let currentServerTestEnv: ServerTestEnv | undefined;

export function installServerTestEnv(
  overrides: ServerTestEnvOverrides = {},
  options: InstallServerTestEnvOptions = {},
) {
  const runtimeEnv = { ...createServerTestEnv() };

  for (const key of Object.keys(serverTestEnvDefaults) as ServerTestEnvKey[]) {
    const nextValue =
      options.overwrite || process.env[key] == null
        ? (overrides[key] ?? serverTestEnvDefaults[key])
        : process.env[key]!;

    runtimeEnv[key] = nextValue;
    process.env[key] = nextValue;
  }

  currentServerTestEnv = runtimeEnv;
  return currentServerTestEnv;
}

export function getServerTestEnv() {
  return currentServerTestEnv ?? installServerTestEnv();
}
