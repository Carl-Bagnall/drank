import type { Drink, DrinkSummary, Facet, Facets } from "../../shared/types";

/**
 * Drink queries.
 *
 * All SQL lives here rather than in route handlers, so the routes stay about
 * HTTP concerns and the queries can be tested directly against D1.
 *
 * Community ratings are averaged at query time against idx_ratings_drink —
 * there is no stored aggregate to keep in sync.
 */

/** Shape D1 returns: snake_case columns plus the joined rating aggregate. */
interface DrinkRow {
  id: string;
  name: string;
  brand: string;
  flavour: string | null;
  category: string | null;
  country: string | null;
  region: string | null;
  volume_ml: number | null;
  packaging: string | null;
  barcode: string | null;
  description: string | null;
  image_url: string | null;
  caffeine_status: string | null;
  sugar_status: string | null;
  status: string;
  external_source: string | null;
  external_source_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  rating_count: number;
  avg_score: number | null;
}

export type DrinkSort = "recent" | "rating" | "name";

export interface ListDrinksOptions {
  /** Free-text query across name, brand, flavour, category and country. */
  q?: string;
  brand?: string;
  category?: string;
  country?: string;
  sort?: DrinkSort;
  limit?: number;
  offset?: number;
}

export const DEFAULT_LIMIT = 24;
export const MAX_LIMIT = 60;

/** Rounds a stored half-point average onto the 0–10 scale, or null. */
function toCommunityAverage(avgScore: number | null): number | null {
  if (avgScore === null) return null;
  return Math.round((avgScore / 2) * 10) / 10;
}

function toSummary(row: DrinkRow): DrinkSummary {
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
    // Populated once accounts exist in Phase 3.
    viewerRating: null,
    inViewerCollection: false,
  };
}

function toDrink(row: DrinkRow): Drink {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    flavour: row.flavour,
    category: row.category,
    country: row.country,
    region: row.region,
    volumeMl: row.volume_ml,
    packaging: row.packaging as Drink["packaging"],
    barcode: row.barcode,
    description: row.description,
    imageUrl: row.image_url,
    caffeineStatus: row.caffeine_status as Drink["caffeineStatus"],
    sugarStatus: row.sugar_status as Drink["sugarStatus"],
    status: row.status as Drink["status"],
    externalSource: row.external_source,
    externalSourceId: row.external_source_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_WITH_RATINGS = `
  SELECT d.*,
         COUNT(r.id) AS rating_count,
         AVG(r.score) AS avg_score
  FROM drinks d
  LEFT JOIN ratings r ON r.drink_id = d.id
`;

/**
 * A page of published drinks, newest first by default.
 *
 * Search is a simple LIKE across the fields users actually search by. The
 * brief is explicit that the MVP should not build a search engine; if this
 * stops being fast enough, the next step is an FTS5 virtual table, not a
 * cleverer LIKE.
 */
export async function listDrinks(
  db: D1Database,
  options: ListDrinksOptions = {},
): Promise<{ items: DrinkSummary[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(options.offset ?? 0, 0);

  const where: string[] = ["d.status = 'published'"];
  const params: unknown[] = [];

  if (options.q) {
    const term = `%${options.q.trim().toLowerCase()}%`;
    where.push(`(
      lower(d.name) LIKE ?
      OR lower(d.brand) LIKE ?
      OR lower(COALESCE(d.flavour, '')) LIKE ?
      OR lower(COALESCE(d.category, '')) LIKE ?
      OR lower(COALESCE(d.country, '')) LIKE ?
    )`);
    params.push(term, term, term, term, term);
  }

  if (options.brand) {
    where.push("d.brand_normalised = ?");
    params.push(options.brand.trim().toLowerCase());
  }
  if (options.category) {
    where.push("d.category = ?");
    params.push(options.category);
  }
  if (options.country) {
    where.push("d.country = ?");
    params.push(options.country.toUpperCase());
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;

  // `avg_score IS NULL` first keeps unrated drinks at the end of a
  // rating-sorted list; SQLite has no portable NULLS LAST here.
  const orderSql =
    options.sort === "name"
      ? "ORDER BY d.name COLLATE NOCASE ASC"
      : options.sort === "rating"
        ? "ORDER BY (avg_score IS NULL) ASC, avg_score DESC, d.name COLLATE NOCASE ASC"
        : "ORDER BY d.created_at DESC, d.name COLLATE NOCASE ASC";

  const listStatement = db
    .prepare(
      `${SELECT_WITH_RATINGS} ${whereSql} GROUP BY d.id ${orderSql} LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset);

  // Counted separately so the total is not affected by LIMIT.
  const countStatement = db
    .prepare(`SELECT COUNT(*) AS total FROM drinks d ${whereSql}`)
    .bind(...params);

  const [listResult, countResult] = await db.batch<DrinkRow | { total: number }>([
    listStatement,
    countStatement,
  ]);

  const items = (listResult.results as DrinkRow[]).map(toSummary);
  const total = (countResult.results as { total: number }[])[0]?.total ?? 0;

  return { items, total };
}

export interface DrinkDetail {
  drink: Drink;
  community: { average: number | null; count: number };
}

/** A single published drink with its community rating, or null if not found. */
export async function getDrinkById(
  db: D1Database,
  id: string,
): Promise<DrinkDetail | null> {
  const row = await db
    .prepare(
      `${SELECT_WITH_RATINGS} WHERE d.id = ? AND d.status = 'published' GROUP BY d.id`,
    )
    .bind(id)
    .first<DrinkRow>();

  if (!row) return null;

  return {
    drink: toDrink(row),
    community: {
      average: toCommunityAverage(row.avg_score),
      count: row.rating_count,
    },
  };
}

/**
 * Other drinks from the same brand — the variant family that makes the
 * catalogue feel collectible ("you have the Cherry, there are six more").
 */
export async function getBrandSiblings(
  db: D1Database,
  drinkId: string,
  brandNormalised: string,
  limit = 8,
): Promise<DrinkSummary[]> {
  const { results } = await db
    .prepare(
      `${SELECT_WITH_RATINGS}
       WHERE d.brand_normalised = ? AND d.id != ? AND d.status = 'published'
       GROUP BY d.id
       ORDER BY d.name COLLATE NOCASE ASC
       LIMIT ?`,
    )
    .bind(brandNormalised, drinkId, limit)
    .all<DrinkRow>();

  return results.map(toSummary);
}

/** Filter options, derived from the catalogue rather than hard-coded. */
export async function getFacets(db: D1Database): Promise<Facets> {
  const facetQuery = (column: string) =>
    db.prepare(
      `SELECT ${column} AS value, COUNT(*) AS count
       FROM drinks
       WHERE status = 'published' AND ${column} IS NOT NULL AND ${column} != ''
       GROUP BY ${column}
       ORDER BY count DESC, value ASC`,
    );

  const [categories, countries, brands] = await db.batch<Facet>([
    facetQuery("category"),
    facetQuery("country"),
    facetQuery("brand"),
  ]);

  return {
    categories: categories.results,
    countries: countries.results,
    brands: brands.results,
  };
}
