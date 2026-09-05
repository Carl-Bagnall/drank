import type {
  CollectionItem,
  CollectionStats,
  CollectionStatus,
  Facet,
  Facets,
} from "../../shared/types";

export type { CollectionItem };

/**
 * Collection queries.
 *
 * A collection entry references a drink; it never copies one. Ratings live in
 * their own table, so "owning" and "scoring" stay separate — the viewer's
 * score is joined in rather than stored on the entry.
 */

export type CollectionSort = "recent" | "highest" | "lowest" | "name";

export interface ListCollectionOptions {
  /** Which list to read: owned drinks or the wantlist. */
  status?: CollectionStatus;
  sort?: CollectionSort;
  brand?: string;
  category?: string;
  country?: string;
  favouritesOnly?: boolean;
  limit?: number;
  offset?: number;
}

export const DEFAULT_LIMIT = 24;
export const MAX_LIMIT = 60;

interface CollectionRow {
  id: string;
  name: string;
  brand: string;
  flavour: string | null;
  category: string | null;
  image_url: string | null;
  status: string;
  added_at: string;
  notes: string | null;
  is_favourite: number;
  viewer_score: number | null;
  rating_count: number;
  avg_score: number | null;
}

function toCommunityAverage(avgScore: number | null): number | null {
  if (avgScore === null) return null;
  // avgScore is a mean of tenths. Rounding it to a whole tenth and then
  // dividing gives the 0–10 scale to one decimal place.
  return Math.round(avgScore) / 10;
}

function toItem(row: CollectionRow): CollectionItem {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    flavour: row.flavour,
    category: row.category,
    imageUrl: row.image_url,
    community: {
      average: toCommunityAverage(row.avg_score),
      count: row.rating_count,
    },
    viewerRating: row.viewer_score === null ? null : row.viewer_score / 10,
    inViewerCollection: row.status === "collected",
    status: row.status as CollectionItem["status"],
    addedAt: row.added_at,
    notes: row.notes,
    isFavourite: row.is_favourite === 1,
  };
}

/**
 * `ur` is the viewer's own rating (at most one row); `r` is every rating on
 * the drink. MAX(ur.score) is used because the join with `r` multiplies rows
 * and ur.score is constant across them.
 */
const SELECT_COLLECTION = `
  SELECT d.id, d.name, d.brand, d.flavour, d.category, d.image_url,
         ce.status, ce.added_at, ce.notes, ce.is_favourite,
         MAX(ur.score) AS viewer_score,
         COUNT(r.id)   AS rating_count,
         AVG(r.score)  AS avg_score
  FROM collection_entries ce
  JOIN drinks d ON d.id = ce.drink_id
  LEFT JOIN ratings ur ON ur.drink_id = d.id AND ur.user_id = ce.user_id
  LEFT JOIN ratings r  ON r.drink_id  = d.id
`;

export async function listCollection(
  db: D1Database,
  userId: string,
  options: ListCollectionOptions = {},
): Promise<{ items: CollectionItem[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(options.offset ?? 0, 0);

  const where: string[] = ["ce.user_id = ?", "ce.status = ?"];
  const params: unknown[] = [userId, options.status ?? "collected"];

  if (options.brand) {
    where.push("d.brand_normalised = ?");
    params.push(options.brand);
  }
  if (options.category) {
    where.push("d.category = ?");
    params.push(options.category);
  }
  if (options.country) {
    where.push("d.country = ?");
    params.push(options.country.toUpperCase());
  }
  if (options.favouritesOnly) {
    where.push("ce.is_favourite = 1");
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  // Unrated drinks sort last in both directions: they are missing data, not
  // a score of zero.
  const orderSql =
    options.sort === "name"
      ? "ORDER BY d.name COLLATE NOCASE ASC"
      : options.sort === "highest"
        ? "ORDER BY (viewer_score IS NULL) ASC, viewer_score DESC, d.name COLLATE NOCASE ASC"
        : options.sort === "lowest"
          ? "ORDER BY (viewer_score IS NULL) ASC, viewer_score ASC, d.name COLLATE NOCASE ASC"
          : "ORDER BY ce.added_at DESC, d.name COLLATE NOCASE ASC";

  const [listResult, countResult] = await db.batch<
    CollectionRow | { total: number }
  >([
    db
      .prepare(
        `${SELECT_COLLECTION} ${whereSql} GROUP BY ce.id ${orderSql} LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset),
    db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM collection_entries ce
         JOIN drinks d ON d.id = ce.drink_id
         ${whereSql}`,
      )
      .bind(...params),
  ]);

  return {
    items: (listResult.results as CollectionRow[]).map(toItem),
    total: (countResult.results as { total: number }[])[0]?.total ?? 0,
  };
}

/**
 * Headline numbers for the collection and profile pages.
 *
 * The average is over the viewer's own ratings for drinks they have
 * collected — "how I rate what I own" — rather than every rating they have
 * ever left.
 */
export async function getCollectionStats(
  db: D1Database,
  userId: string,
): Promise<CollectionStats> {
  const [totals, average] = await db.batch<Record<string, number | null>>([
    db
      .prepare(
        // Every total is scoped to collected drinks. A wantlist drink must
        // never inflate the collection count, the brand count or the country
        // count — wanting a drink is not owning one.
        `SELECT
           COUNT(*) FILTER (WHERE ce.status = 'collected')                     AS drink_count,
           COUNT(DISTINCT CASE WHEN ce.status = 'collected'
                               THEN d.brand_normalised END)                    AS brand_count,
           COUNT(DISTINCT CASE WHEN ce.status = 'collected'
                               THEN d.country END)                             AS country_count,
           COUNT(*) FILTER (WHERE ce.status = 'wanted')                        AS wantlist_count
         FROM collection_entries ce
         JOIN drinks d ON d.id = ce.drink_id
         WHERE ce.user_id = ?`,
      )
      .bind(userId),
    db
      .prepare(
        `SELECT AVG(r.score) AS avg_score
         FROM ratings r
         JOIN collection_entries ce
           ON ce.drink_id = r.drink_id AND ce.user_id = r.user_id
         WHERE r.user_id = ? AND ce.status = 'collected'`,
      )
      .bind(userId),
  ]);

  const row = totals.results[0] ?? {};
  const avgScore = average.results[0]?.["avg_score"] ?? null;

  return {
    drinkCount: Number(row["drink_count"] ?? 0),
    brandCount: Number(row["brand_count"] ?? 0),
    countryCount: Number(row["country_count"] ?? 0),
    wantlistCount: Number(row["wantlist_count"] ?? 0),
    averageRating: toCommunityAverage(avgScore),
  };
}

/** Filter options drawn from the drinks the user actually owns. */
export async function getCollectionFacets(
  db: D1Database,
  userId: string,
): Promise<Facets> {
  const facetQuery = (column: string, value: string) =>
    db
      .prepare(
        `SELECT ${value} AS value, COUNT(*) AS count
         FROM collection_entries ce
         JOIN drinks d ON d.id = ce.drink_id
         WHERE ce.user_id = ? AND ce.status = 'collected'
           AND ${column} IS NOT NULL AND ${column} != ''
         GROUP BY ${column}
         ORDER BY count DESC, value ASC`,
      )
      .bind(userId);

  const [categories, countries, brands] = await db.batch<Facet>([
    facetQuery("d.category", "d.category"),
    facetQuery("d.country", "d.country"),
    facetQuery("d.brand_normalised", "d.brand"),
  ]);

  return {
    categories: categories.results,
    countries: countries.results,
    brands: brands.results,
  };
}

export type AddResult =
  | { status: "added" }
  | { status: "moved" }
  | { status: "unchanged" }
  | { status: "no_such_drink" };

/**
 * Puts a drink on one of the user's two lists, moving it between them if it
 * is already on the other.
 *
 * Because a drink can only be owned or wanted — never both — moving to the
 * wantlist withdraws any rating: a rating means you have tried it, and the
 * wantlist is for drinks you have not.
 *
 * `added_at` is reset on a move, so the Collection page's "recently added"
 * sort means "recently collected" rather than "first noticed".
 */
export async function addToCollection(
  db: D1Database,
  userId: string,
  drinkId: string,
  status: CollectionStatus = "collected",
): Promise<AddResult> {
  const drink = await db
    .prepare("SELECT id FROM drinks WHERE id = ? AND status = 'published'")
    .bind(drinkId)
    .first<{ id: string }>();

  if (!drink) return { status: "no_such_drink" };

  const existing = await db
    .prepare(
      "SELECT status FROM collection_entries WHERE user_id = ? AND drink_id = ?",
    )
    .bind(userId, drinkId)
    .first<{ status: CollectionStatus }>();

  if (!existing) {
    await db
      .prepare(
        "INSERT INTO collection_entries (id, user_id, drink_id, status) VALUES (?, ?, ?, ?)",
      )
      .bind(crypto.randomUUID(), userId, drinkId, status)
      .run();
    return { status: "added" };
  }

  if (existing.status === status) return { status: "unchanged" };

  const statements = [
    db
      .prepare(
        `UPDATE collection_entries
         SET status = ?, added_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE user_id = ? AND drink_id = ?`,
      )
      .bind(status, userId, drinkId),
  ];

  if (status === "wanted") {
    statements.push(
      db
        .prepare("DELETE FROM ratings WHERE user_id = ? AND drink_id = ?")
        .bind(userId, drinkId),
    );
  }

  await db.batch(statements);
  return { status: "moved" };
}

/**
 * Ensures a drink is in the user's collection, used when they rate it.
 *
 * Rating a drink means having tried it, so it belongs in the collection —
 * this is what stops a rating existing without an entry. A drink already on
 * the wantlist is promoted rather than duplicated.
 */
export async function ensureCollected(
  db: D1Database,
  userId: string,
  drinkId: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO collection_entries (id, user_id, drink_id, status)
       VALUES (?, ?, ?, 'collected')
       ON CONFLICT(user_id, drink_id) DO UPDATE SET
         status   = 'collected',
         added_at = CASE
           WHEN collection_entries.status = 'wanted'
           THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           ELSE collection_entries.added_at
         END`,
    )
    .bind(crypto.randomUUID(), userId, drinkId)
    .run();
}

/** Returns false when the drink was not in the collection to begin with. */
export async function removeFromCollection(
  db: D1Database,
  userId: string,
  drinkId: string,
): Promise<boolean> {
  // The rating goes with it. A rating now means "I have tried this", so one
  // cannot outlive the entry that says so.
  const [, entryResult] = await db.batch([
    db
      .prepare("DELETE FROM ratings WHERE user_id = ? AND drink_id = ?")
      .bind(userId, drinkId),
    db
      .prepare("DELETE FROM collection_entries WHERE user_id = ? AND drink_id = ?")
      .bind(userId, drinkId),
  ]);

  return entryResult.meta.changes > 0;
}

/** Updates notes and favourite status. Returns false if there is no entry. */
export async function updateCollectionEntry(
  db: D1Database,
  userId: string,
  drinkId: string,
  changes: { notes?: string | null; isFavourite?: boolean | null },
): Promise<boolean> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (changes.notes !== undefined) {
    sets.push("notes = ?");
    params.push(changes.notes);
  }
  if (changes.isFavourite !== undefined && changes.isFavourite !== null) {
    sets.push("is_favourite = ?");
    params.push(changes.isFavourite ? 1 : 0);
  }

  if (sets.length === 0) return true;

  const result = await db
    .prepare(
      `UPDATE collection_entries SET ${sets.join(", ")} WHERE user_id = ? AND drink_id = ?`,
    )
    .bind(...params, userId, drinkId)
    .run();

  return result.meta.changes > 0;
}

/** The drinks a user has marked as favourites, for their profile. */
export async function getFavourites(
  db: D1Database,
  userId: string,
  limit = 12,
): Promise<CollectionItem[]> {
  const { results } = await db
    .prepare(
      `${SELECT_COLLECTION}
       WHERE ce.user_id = ? AND ce.status = 'collected' AND ce.is_favourite = 1
       GROUP BY ce.id
       ORDER BY ce.added_at DESC
       LIMIT ?`,
    )
    .bind(userId, limit)
    .all<CollectionRow>();

  return results.map(toItem);
}
