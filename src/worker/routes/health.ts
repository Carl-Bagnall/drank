import { Hono } from "hono";
import type { Env } from "../index";

/**
 * Health check.
 *
 * Deliberately touches D1 rather than returning a bare `{ ok: true }`. A
 * health endpoint that does not exercise its bindings will happily report
 * success while the database binding is misconfigured, which is exactly the
 * failure this project needs to catch early.
 */
export const health = new Hono<{ Bindings: Env }>();

health.get("/health", async (c) => {
  const startedAt = Date.now();

  try {
    const row = await c.env.DB.prepare(
      "SELECT COUNT(*) AS count FROM drinks WHERE status = 'published'",
    ).first<{ count: number }>();

    return c.json({
      status: "ok",
      database: "connected",
      publishedDrinks: row?.count ?? 0,
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("Health check failed to query D1:", err);
    return c.json(
      {
        status: "degraded",
        database: "unavailable",
        message:
          "Could not query D1. Have you run `npm run db:migrate` and `npm run db:seed`?",
      },
      503,
    );
  }
});
