import type { Context, Next } from "hono";
import type { AppEnv } from "./index";
import type { ApiError } from "../shared/types";

/**
 * Rate limiting for the authentication endpoints.
 *
 * Uses Cloudflare's own rate limiter rather than a hand-rolled counter in D1.
 * A counter would need its own table, its own cleanup and its own correctness
 * argument across concurrent isolates, and would still be per-region — the
 * platform binding is the thing actually designed for this.
 *
 * This is what defends the login form. Identifier secrecy never did: a
 * username has to be checkable for anyone to pick one, so limiting attempts is
 * the real control, alongside password length.
 */

const TOO_MANY: ApiError = {
  error: "rate_limited",
  message: "Too many attempts. Wait a minute and try again.",
};

/**
 * Limits by client IP, when the client can be identified.
 *
 * `CF-Connecting-IP` is set by Cloudflare's edge and cannot be forged by the
 * caller — unlike `X-Forwarded-For`, which is client-supplied and would let an
 * attacker mint a fresh bucket per request just by varying a header.
 *
 * When that header is absent the request did not arrive through the edge:
 * local development, and the test runtime. There is deliberately no fallback
 * key. Lumping every unidentified caller into one shared bucket does not limit
 * anyone individually — it just throttles everybody together once any one of
 * them is busy, which is how a full test suite locked itself out. This is not
 * a bypass in production, where a request cannot reach the Worker without
 * passing through the edge that sets the header.
 *
 * The binding itself is also treated as optional, so a missing one fails open
 * rather than making a dev server unusable.
 */
export async function rateLimitAuth(c: Context<AppEnv>, next: Next) {
  const limiter = c.env.AUTH_RATE_LIMIT;
  const clientIp = c.req.header("CF-Connecting-IP");

  if (limiter && clientIp) {
    let allowed = true;
    try {
      const result = await limiter.limit({ key: clientIp });
      // Only an explicit refusal blocks. A limiter that answers with
      // something unexpected must not be read as "denied".
      allowed = result?.success !== false;
    } catch (err) {
      // Fails open, deliberately. A rate limiter that is itself broken must
      // not be able to lock everybody out of signing in; that turns a
      // defensive measure into the outage it was meant to prevent.
      console.error("Rate limiter unavailable, allowing request:", err);
    }

    if (!allowed) {
      // 429 with Retry-After, so a well-behaved client backs off rather than
      // hammering.
      c.header("Retry-After", "60");
      return c.json(TOO_MANY, 429);
    }
  }

  await next();
}
