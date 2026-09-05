import { Hono } from "hono";
import type { AppEnv } from "../index";
import type { ApiError } from "../../shared/types";
import { createOpenFoodFactsProvider } from "../services/openFoodFacts";
import { isValidBarcode, type LookupResult } from "../services/productProvider";

export const products = new Hono<AppEnv>();

/** Successful lookups are stable enough to cache for a day. */
const CACHE_SECONDS = 86_400;

/**
 * GET /api/products/barcode/:barcode
 *
 * Answers three different things, and the client treats all three as normal:
 *
 *   in_catalogue — Drank already has this drink; go straight to it.
 *   suggestion   — an external provider recognised it; prefill the add form.
 *   not_found    — nobody knows it; offer a blank add form.
 *
 * An unknown barcode is explicitly not an error. Neither is the provider
 * being down: that returns `not_found` to the client with a note, because
 * from the user's point of view the next step is identical — type it in.
 */
products.get("/products/barcode/:barcode", async (c) => {
  const barcode = c.req.param("barcode").trim();

  if (!isValidBarcode(barcode)) {
    const error: ApiError = {
      error: "bad_request",
      message: "A barcode is 8 to 14 digits.",
    };
    return c.json(error, 400);
  }

  // The catalogue is the source of truth, so it is always consulted first.
  // A drink somebody has already added here beats anything external.
  const existing = await c.env.DB.prepare(
    `SELECT id, name, brand, image_url
     FROM drinks
     WHERE barcode = ? AND status = 'published'`,
  )
    .bind(barcode)
    .first<{ id: string; name: string; brand: string; image_url: string | null }>();

  if (existing) {
    return c.json({
      status: "in_catalogue",
      drink: {
        id: existing.id,
        name: existing.name,
        brand: existing.brand,
        imageUrl: existing.image_url,
      },
    });
  }

  const result = await lookupWithCache(c.env, barcode);

  if (result.status === "found") {
    return c.json({ status: "suggestion", suggestion: result.suggestion });
  }

  // Deliberately the same shape whether the provider said no or could not be
  // reached. The user's next step is the same either way; `providerAvailable`
  // lets the UI word it honestly without turning it into a failure.
  return c.json({
    status: "not_found",
    barcode,
    providerAvailable: result.status === "not_found",
  });
});

/**
 * Looks a barcode up, going through the Cloudflare cache first.
 *
 * Uses the platform cache rather than adding a KV namespace or a third-party
 * store: it is free, needs no configuration, and this is exactly the
 * read-through case it exists for.
 *
 * Failures are never cached, so a provider outage cannot be remembered as a
 * missing product for a day.
 */
async function lookupWithCache(
  env: AppEnv["Bindings"],
  barcode: string,
): Promise<LookupResult> {
  // A synthetic key: never fetched, only used to address the cache.
  const cacheKey = new Request(
    `https://drank.invalid/product-lookup/${barcode}`,
    { method: "GET" },
  );
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      return (await cached.json()) as LookupResult;
    } catch {
      // A corrupt entry is not worth failing over; fall through and re-fetch.
    }
  }

  const provider = createOpenFoodFactsProvider(env.PRODUCT_USER_AGENT);
  const result = await provider.lookupByBarcode(barcode);

  if (result.status === "unavailable") {
    console.error(
      `Product lookup unavailable for ${barcode}: ${result.reason}`,
    );
    return result;
  }

  await cache.put(
    cacheKey,
    new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `max-age=${CACHE_SECONDS}`,
      },
    }),
  );

  return result;
}
