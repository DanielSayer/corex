import { serverTestEnv } from "./test-env";

for (const [key, value] of Object.entries(serverTestEnv)) {
  process.env[key] ??= value;
}
