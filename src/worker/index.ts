import { Hono } from "hono";
import type { ApiError } from "../shared/types";
import type { SessionUser } from "./auth/session";
import { getSessionUser, readSessionCookie } from "./auth/session";
import { ValidationError } from "./validate";
import { auth } from "./routes/auth";
import { drinks } from "./routes/drinks";
import { health } from "./routes/health";
import { ratings } from "./routes/ratings";
import { users } from "./routes/users";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

/** Hono environment: bindings plus the resolved session user. */
export type AppEnv = {
  Bindings: Env;
  Variables: { user: SessionUser | null };
};

const app = new Hono<AppEnv>();

/**
 * Resolve the session once per request and hand it to every route.
 *
 * Routes read `c.get("user")` rather than parsing cookies themselves, so
 * there is one place where "who is this" is decided.
 */
app.use("/api/*", async (c, next) => {
  c.set("user", await getSessionUser(c.env.DB, readSessionCookie(c)));
  await next();
});

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
  // Validation failures are the caller's fault and safe to describe.
  if (err instanceof ValidationError) {
    const body: ApiError = { error: "bad_request", message: err.message };
    return c.json(body, 400);
  }

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
app.route("/api", auth);
app.route("/api", drinks);
app.route("/api", ratings);
app.route("/api", users);

export default app;
