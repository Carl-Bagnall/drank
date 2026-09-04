import type { CommunityRating } from "../../shared/types";

/**
 * Rating queries.
 *
 * Scores are stored as INTEGER half-points, 0–20, representing 0.0–10.0.
 * Conversion lives in `src/shared/rating.ts`; this module deals only in the
 * stored representation and lets callers convert at the boundary.
 */

/** One score per person per drink, enforced by UNIQUE(user_id, drink_id). */
export type SetRatingResult =
  | { status: "ok"; community: CommunityRating }
  | { status: "no_such_drink" };

function toCommunityAverage(avgScore: number | null): number | null {
  if (avgScore === null) return null;
  // avgScore is a mean of tenths. Rounding it to a whole tenth and then
  // dividing gives the 0–10 scale to one decimal place.
  return Math.round(avgScore) / 10;
}

export async function getCommunityRating(
  db: D1Database,
  drinkId: string,
): Promise<CommunityRating> {
  const row = await db
    .prepare(
      "SELECT AVG(score) AS avg_score, COUNT(*) AS count FROM ratings WHERE drink_id = ?",
    )
    .bind(drinkId)
    .first<{ avg_score: number | null; count: number }>();

  return {
    average: toCommunityAverage(row?.avg_score ?? null),
    count: row?.count ?? 0,
  };
}

/**
 * Creates or replaces this user's score for a drink.
 *
 * An upsert rather than a read-then-write: the unique constraint is the
 * guarantee, and re-rating must update in place rather than either failing or
 * accumulating duplicate rows.
 */
export async function setRating(
  db: D1Database,
  userId: string,
  drinkId: string,
  scoreHalfPoints: number,
): Promise<SetRatingResult> {
  const drink = await db
    .prepare("SELECT id FROM drinks WHERE id = ? AND status = 'published'")
    .bind(drinkId)
    .first<{ id: string }>();

  if (!drink) return { status: "no_such_drink" };

  await db
    .prepare(
      `INSERT INTO ratings (id, user_id, drink_id, score)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, drink_id) DO UPDATE SET
         score = excluded.score,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(crypto.randomUUID(), userId, drinkId, scoreHalfPoints)
    .run();

  return { status: "ok", community: await getCommunityRating(db, drinkId) };
}

/** Returns false when the user had not rated the drink. */
export async function deleteRating(
  db: D1Database,
  userId: string,
  drinkId: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM ratings WHERE user_id = ? AND drink_id = ?")
    .bind(userId, drinkId)
    .run();

  return result.meta.changes > 0;
}

export interface RatingBreakdown {
  community: CommunityRating;
  /** Counts per whole-number band, 0–10. Tenths round down into a band. */
  distribution: { score: number; count: number }[];
}

/**
 * How a drink's ratings are spread.
 *
 * Grouped into eleven whole-number bands rather than 101 tenth-point ones:
 * a histogram at that resolution would be almost entirely empty columns, and
 * bands read faster on a phone.
 */
export async function getRatingBreakdown(
  db: D1Database,
  drinkId: string,
): Promise<RatingBreakdown> {
  const { results } = await db
    .prepare(
      `SELECT CAST(score / 10 AS INTEGER) AS band, COUNT(*) AS count
       FROM ratings
       WHERE drink_id = ?
       GROUP BY band
       ORDER BY band ASC`,
    )
    .bind(drinkId)
    .all<{ band: number; count: number }>();

  const counts = new Map(results.map((row) => [row.band, row.count]));
  const distribution = Array.from({ length: 11 }, (_, score) => ({
    score,
    count: counts.get(score) ?? 0,
  }));

  return { community: await getCommunityRating(db, drinkId), distribution };
}
