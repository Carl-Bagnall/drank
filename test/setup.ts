import { applyD1Migrations, env } from "cloudflare:test";

// Runs once per test worker: brings the isolated D1 instance up to the same
// schema the app ships, straight from migrations/. If a migration is broken,
// the whole suite fails here rather than in a confusing downstream assertion.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
