import { defineConfig } from "vitest/config";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";

// Tests run inside workerd against a real (local) D1 database rather than a
// mock, so schema constraints — the UNIQUE that stops duplicate collection
// entries, the rating CHECK — are actually exercised by the test suite.
const migrations = await readD1Migrations("./migrations");

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
  },
});
