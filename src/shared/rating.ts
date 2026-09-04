/**
 * Rating scale conversion.
 *
 * Users see 0–10 in half-point steps. The database stores half-points as an
 * INTEGER 0–20, which keeps the CHECK constraint trivial and sidesteps float
 * comparison bugs. Every conversion between the two lives here so the rule
 * exists in exactly one place.
 */

export const RATING_MIN = 0;
export const RATING_MAX = 10;
export const RATING_STEP = 0.5;

/** Storage bounds, in half-points. */
export const RATING_MIN_HALF_POINTS = 0;
export const RATING_MAX_HALF_POINTS = 20;

/** True when `score` is on the 0–10 scale and lands on a half point. */
export function isValidRating(score: number): boolean {
  return (
    Number.isFinite(score) &&
    score >= RATING_MIN &&
    score <= RATING_MAX &&
    Number.isInteger(score * 2)
  );
}

/**
 * Convert a 0–10 display score to the 0–20 half-points stored in D1.
 * @throws RangeError if the score is not a valid half-point rating.
 */
export function toHalfPoints(score: number): number {
  if (!isValidRating(score)) {
    throw new RangeError(
      `Rating must be between ${RATING_MIN} and ${RATING_MAX} in steps of ${RATING_STEP}; received ${score}`,
    );
  }
  return Math.round(score * 2);
}

/** Convert stored half-points back to the 0–10 display scale. */
export function fromHalfPoints(halfPoints: number): number {
  return halfPoints / 2;
}

/**
 * Format a score for display: "8", "8.5", or an em dash when unrated.
 * Whole numbers deliberately drop the ".0" so cards stay visually quiet.
 */
export function formatRating(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return "—";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/**
 * Average an array of stored half-point scores, returned on the 0–10 scale
 * and rounded to one decimal place. Returns null for an empty array, which
 * is how "no community rating yet" is represented throughout the app.
 */
export function averageFromHalfPoints(halfPoints: readonly number[]): number | null {
  if (halfPoints.length === 0) return null;
  const total = halfPoints.reduce((sum, value) => sum + value, 0);
  return Math.round((total / halfPoints.length / 2) * 10) / 10;
}

/** Every selectable rating value, for building rating inputs. */
export function ratingOptions(): number[] {
  const options: number[] = [];
  for (let hp = RATING_MIN_HALF_POINTS; hp <= RATING_MAX_HALF_POINTS; hp++) {
    options.push(fromHalfPoints(hp));
  }
  return options;
}
