import { Hono } from "hono";
import type { AppEnv } from "../index";
import type { ApiError } from "../../shared/types";
import { normaliseBrand } from "../../shared/brand";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  addToCollection,
  getCollectionFacets,
  getCollectionStats,
  getFavourites,
  listCollection,
  removeFromCollection,
  updateCollectionEntry,
  type CollectionSort,
} from "../db/collection";
import { optionalBoolean, optionalString, readJsonObject } from "../validate";

export const users = new Hono<AppEnv>();

const SORTS: readonly CollectionSort[] = ["recent", "highest", "lowest", "name"];
const MAX_NOTES = 2000;

const UNAUTHENTICATED: ApiError = {
  error: "unauthenticated",
  message: "You need to be signed in to do that.",
};

users.use("/users/me/*", async (c, next) => {
  if (!c.get("user")) return c.json(UNAUTHENTICATED, 401);
  await next();
});

users.use("/users/me", async (c, next) => {
  if (!c.get("user")) return c.json(UNAUTHENTICATED, 401);
  await next();
});

/** GET /api/users/me — the signed-in user and their headline stats. */
users.get("/users/me", async (c) => {
  const user = c.get("user")!;
  return c.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
    },
    stats: await getCollectionStats(c.env.DB, user.id),
  });
});

/** GET /api/users/me/favourites — for the profile page. */
users.get("/users/me/favourites", async (c) => {
  const user = c.get("user")!;
  return c.json({ items: await getFavourites(c.env.DB, user.id) });
});

/** GET /api/users/me/collection/facets — filters drawn from what they own. */
users.get("/users/me/collection/facets", async (c) => {
  const user = c.get("user")!;
  return c.json(await getCollectionFacets(c.env.DB, user.id));
});

/** GET /api/users/me/collection — sorted, filtered and paginated. */
users.get("/users/me/collection", async (c) => {
  const user = c.get("user")!;
  const params = new URL(c.req.url).searchParams;

  const sortParam = params.get("sort") ?? "recent";
  if (!SORTS.includes(sortParam as CollectionSort)) {
    return c.json(
      { error: "bad_request", message: `sort must be one of: ${SORTS.join(", ")}.` },
      400,
    );
  }

  const limitParam = params.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitParam !== null) {
    limit = Number(limitParam);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return c.json(
        {
          error: "bad_request",
          message: `limit must be a whole number between 1 and ${MAX_LIMIT}.`,
        },
        400,
      );
    }
  }

  const cursor = params.get("cursor");
  const offset = cursor === null ? 0 : Number(cursor);
  if (!Number.isInteger(offset) || offset < 0) {
    return c.json({ error: "bad_request", message: "cursor is not valid." }, 400);
  }

  const brand = params.get("brand")?.trim();
  const { items, total } = await listCollection(c.env.DB, user.id, {
    sort: sortParam as CollectionSort,
    brand: brand ? normaliseBrand(brand) : undefined,
    category: params.get("category")?.trim() || undefined,
    country: params.get("country")?.trim() || undefined,
    favouritesOnly: params.get("favourites") === "true",
    limit,
    offset,
  });

  const nextOffset = offset + items.length;
  return c.json({
    items,
    total,
    nextCursor: nextOffset < total ? String(nextOffset) : null,
    // Stats describe the whole collection, not the filtered page.
    stats: await getCollectionStats(c.env.DB, user.id),
  });
});

/** POST /api/users/me/collection — add a drink. */
users.post("/users/me/collection", async (c) => {
  const user = c.get("user")!;
  const body = await readJsonObject(c.req.raw);

  const drinkId = optionalString(body, "drinkId", { max: 200 });
  if (!drinkId) {
    return c.json({ error: "bad_request", message: "drinkId is required." }, 400);
  }

  const result = await addToCollection(c.env.DB, user.id, drinkId);

  if (result.status === "no_such_drink") {
    return c.json(
      { error: "not_found", message: "No drink with that id." } satisfies ApiError,
      404,
    );
  }

  // A duplicate is not an error the user needs to recover from — the brief
  // asks that they simply be taken to the entry they already have. 200 with
  // `alreadyCollected` lets the client say so without a failure path.
  return c.json(
    { drinkId, alreadyCollected: result.status === "already_collected" },
    result.status === "added" ? 201 : 200,
  );
});

/** PATCH /api/users/me/collection/:drinkId — notes and favourite status. */
users.patch("/users/me/collection/:drinkId", async (c) => {
  const user = c.get("user")!;
  const drinkId = c.req.param("drinkId");
  const body = await readJsonObject(c.req.raw);

  const changes: { notes?: string | null; isFavourite?: boolean | null } = {};
  if ("notes" in body) changes.notes = optionalString(body, "notes", { max: MAX_NOTES });
  if ("isFavourite" in body) changes.isFavourite = optionalBoolean(body, "isFavourite");

  const updated = await updateCollectionEntry(c.env.DB, user.id, drinkId, changes);
  if (!updated) {
    return c.json(
      {
        error: "not_found",
        message: "That drink is not in your collection.",
      } satisfies ApiError,
      404,
    );
  }

  return c.json({ drinkId, ...changes });
});

/** DELETE /api/users/me/collection/:drinkId — remove a drink. */
users.delete("/users/me/collection/:drinkId", async (c) => {
  const user = c.get("user")!;
  const removed = await removeFromCollection(
    c.env.DB,
    user.id,
    c.req.param("drinkId"),
  );

  if (!removed) {
    return c.json(
      {
        error: "not_found",
        message: "That drink is not in your collection.",
      } satisfies ApiError,
      404,
    );
  }

  return c.json({ drinkId: c.req.param("drinkId"), removed: true });
});
