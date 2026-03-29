import { setDefaultTimeout } from "bun:test";
import { installServerTestEnv } from "@corex/env/test";

installServerTestEnv();
setDefaultTimeout(60_000);
