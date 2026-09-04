import { Hono } from "hono";
import type { Env } from "../index";
import type { ApiError } from "../../shared/types";
import { normaliseBrand } from "../../shared/brand";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  getBrandSiblings,
  getDrinkById,
  getFacets,
  listDrinks,
  type DrinkSort,
} from "../db/drinks";

export const drinks = new Hono<{ Bindings: Env }>();

const SORTS: readonly DrinkSort[] = ["recent", "rating", "name"];
const MAX_QUERY_LENGTH = 100;

function badRequest(message: string): ApiError {
  return { error: "bad_request", message };
}

/**
 * The cursor is deliberately opaque to callers. It currently encodes an
 * offset, which is adequate for a catalogue of this size; moving to keyset
 * pagination later changes only this encoding, not the API shape.
 */
function decodeCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) return 0;
  const offset = Number(cursor);
  if (!Number.isInteger(offset) || offset < 0) return null;
  return offset;
}

/**
 * GET /api/drinks
 *
 * Listing, search and filtering are one endpoint rather than a separate
 * /api/search, because they differ only by a WHERE clause. Duplicating the
 * sorting, pagination and rating-aggregation logic across two routes would
 * be a maintenance cost with no benefit.
 */
drinks.get("/drinks", async (c) => {
  const url = new URL(c.req.url);
  const params = url.searchParams;

  const q = params.get("q")?.trim() || undefined;
  if (q && q.length > MAX_QUERY_LENGTH) {
    return c.json(
      badRequest(`Search query must be ${MAX_QUERY_LENGTH} characters or fewer.`),
      400,
    );
  }

  const sortParam = params.get("sort") ?? "recent";
  if (!SORTS.includes(sortParam as DrinkSort)) {
    return c.json(badRequest(`sort must be one of: ${SORTS.join(", ")}.`), 400);
  }

  const limitParam = params.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    limit = Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return c.json(
        badRequest(`limit must be a whole number between 1 and ${MAX_LIMIT}.`),
        400,
      );
    }
  }

  const offset = decodeCursor(params.get("cursor") ?? undefined);
  if (offset === null) {
    return c.json(badRequest("cursor is not valid."), 400);
  }

  const brand = params.get("brand")?.trim();
  const { items, total } = await listDrinks(c.env.DB, {
    q,
    brand: brand ? normaliseBrand(brand) : undefined,
    category: params.get("category")?.trim() || undefined,
    country: params.get("country")?.trim() || undefined,
    sort: sortParam as DrinkSort,
    limit,
    offset,
  });

  const nextOffset = offset + items.length;
  return c.json({
    items,
    total,
    nextCursor: nextOffset < total ? String(nextOffset) : null,
  });
});

/**
 * GET /api/drinks/facets
 *
 * Declared before /drinks/:id, otherwise "facets" is captured as an id.
 */
drinks.get("/drinks/facets", async (c) => {
  return c.json(await getFacets(c.env.DB));
});

/** GET /api/drinks/:id — one drink, its community rating and its siblings. */
drinks.get("/drinks/:id", async (c) => {
  const id = c.req.param("id");

  const detail = await getDrinkById(c.env.DB, id);
  if (!detail) {
    const body: ApiError = {
      error: "not_found",
      message: "No drink with that id.",
    };
    return c.json(body, 404);
  }

  const siblings = await getBrandSiblings(
    c.env.DB,
    detail.drink.id,
    normaliseBrand(detail.drink.brand),
  );

  return c.json({
    drink: detail.drink,
    community: detail.community,
    siblings,
    // Populated once accounts exist in Phase 3.
    viewerRating: null,
    inViewerCollection: false,
  });
});
