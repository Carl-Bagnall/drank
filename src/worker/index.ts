import { Hono } from "hono";
import type { ApiError } from "../shared/types";
import type { SessionUser } from "./auth/session";
import { getSessionUser, readSessionCookie } from "./auth/session";
import { ValidationError } from "./validate";
import { rateLimitAuth } from "./rateLimit";
import { auth } from "./routes/auth";
import { drinks } from "./routes/drinks";
import { health } from "./routes/health";
import { products } from "./routes/products";
import { ratings } from "./routes/ratings";
import { users } from "./routes/users";

/**
 * Bindings, taken from the types `wrangler types` generates out of
 * wrangler.jsonc.
 *
 * Deliberately not hand-written. A hand-maintained copy silently drifts from
 * the config — adding a binding to wrangler.jsonc and forgetting it here
 * produces a type error at the use site rather than at the source, which is
 * exactly the confusion this avoids. Run `npm run cf-typegen` after changing
 * bindings.
 */
export type Env = Cloudflare.Env;

/** Hono environment: bindings plus the resolved session user. */
export type AppEnv = {
  Bindings: Env;
  Variables: { user: SessionUser | null };
};

const app = new Hono<AppEnv>();

/**
 * Rate limiting sits ahead of everything else, so a flood of sign-in attempts
 * is rejected before it costs a session lookup or a database read.
 */
app.use("/api/auth/*", rateLimitAuth);

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
app.route("/api", products);
app.route("/api", ratings);
app.route("/api", users);

export default app;
