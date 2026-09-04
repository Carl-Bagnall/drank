import { Hono } from "hono";
import type { ApiError } from "../shared/types";
import { health } from "./routes/health";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * Every API response — success or failure — is JSON. `run_worker_first` in
 * wrangler.jsonc routes /api/* here before the SPA asset fallback, so an
 * unknown API path 404s as JSON rather than silently returning index.html.
 */
app.notFound((c) => {
  const body: ApiError = {
    error: "not_found",
    message: `No API route matches ${c.req.method} ${new URL(c.req.url).pathname}`,
  };
  return c.json(body, 404);
});

app.onError((err, c) => {
  // Log the real error for `wrangler tail`, but never leak internals to the
  // client — the message could contain query fragments or stack detail.
  console.error("Unhandled API error:", err);
  const body: ApiError = {
    error: "internal_error",
    message: "Something went wrong. Please try again.",
  };
  return c.json(body, 500);
});

app.route("/api", health);

export default app;
