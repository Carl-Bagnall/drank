import { Hono } from "hono";
import type { AppEnv } from "../index";
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
import { createDrink, findPossibleDuplicates } from "../db/createDrink";
import {
  DRINK_CATEGORIES,
  PACKAGING_TYPES,
  optionalBarcode,
  optionalCountry,
  optionalEnum,
  optionalImageUrl,
  optionalPositiveInt,
  optionalString,
  readJsonObject,
  requireString,
} from "../validate";

export const drinks = new Hono<AppEnv>();

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
    viewerId: c.get("user")?.id ?? null,
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

  const viewerId = c.get("user")?.id ?? null;
  const detail = await getDrinkById(c.env.DB, id, viewerId);
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
    viewerId,
  );

  return c.json({
    drink: detail.drink,
    community: detail.community,
    siblings,
    viewerRating: detail.viewerRating,
    inViewerCollection: detail.inViewerCollection,
    viewerEntry: detail.viewerEntry,
  });
});

/**
 * POST /api/drinks — contribute a drink to the catalogue.
 *
 * Requires an account. An anonymous write endpoint on a public catalogue is a
 * spam vector with nobody to attribute or moderate against, and `created_by`
 * is what makes contributions traceable.
 *
 * Only name and brand are required: the brief is explicit that a user should
 * be able to add a drink from just those, and every other column is nullable
 * to match.
 */
drinks.post("/drinks", async (c) => {
  const user = c.get("user");
  if (!user) {
    const error: ApiError = {
      error: "unauthenticated",
      message: "You need to be signed in to add a drink.",
    };
    return c.json(error, 401);
  }

  const body = await readJsonObject(c.req.raw);

  const result = await createDrink(c.env.DB, {
    name: requireString(body, "name", { max: 200 }),
    brand: requireString(body, "brand", { max: 120 }),
    flavour: optionalString(body, "flavour", { max: 120 }),
    category: optionalEnum(body, "category", DRINK_CATEGORIES),
    country: optionalCountry(body),
    volumeMl: optionalPositiveInt(body, "volumeMl", 10_000),
    packaging: optionalEnum(body, "packaging", PACKAGING_TYPES),
    barcode: optionalBarcode(body),
    description: optionalString(body, "description", { max: 2000 }),
    imageUrl: optionalImageUrl(body),
    externalSource: optionalString(body, "externalSource", { max: 60 }),
    externalSourceId: optionalString(body, "externalSourceId", { max: 120 }),
    createdByUserId: user.id,
  });

  if (result.status === "duplicate_barcode") {
    // Not a failure to recover from: that barcode is already catalogued, so
    // the useful response is the drink they were about to duplicate.
    return c.json(
      {
        error: "already_exists",
        message: "A drink with that barcode is already in the catalogue.",
        drinkId: result.id,
      },
      409,
    );
  }

  return c.json({ id: result.id }, 201);
});

/**
 * GET /api/drinks/:id/siblings-by-brand — what already exists under a brand.
 *
 * Used by the add form to surface possible duplicates before creating. It
 * never blocks: variants really are separate drinks, so this only shows the
 * family so somebody can spot the one they meant.
 */
drinks.get("/brands/:brand/drinks", async (c) => {
  const brand = c.req.param("brand");
  return c.json({ items: await findPossibleDuplicates(c.env.DB, brand) });
});
