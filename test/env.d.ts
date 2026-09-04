// `env` from "cloudflare:test" is typed as Cloudflare.Env, the namespace that
// `wrangler types` generates into worker-configuration.d.ts. Test-only
// bindings are declared by merging into that interface.
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import("@cloudflare/vitest-pool-workers").D1Migration[];
  }
}
