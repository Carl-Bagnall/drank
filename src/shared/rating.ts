/**
 * Rating scale conversion.
 *
 * Users see 0–10 in steps of 0.1. The database stores tenths as an INTEGER
 * 0–100, which keeps the CHECK constraint exact and keeps floating-point
 * values out of the database entirely. Every conversion between the two lives
 * here so the rule exists in exactly one place.
 */

export const RATING_MIN = 0;
export const RATING_MAX = 10;
export const RATING_STEP = 0.1;

/** Storage bounds, in tenths. */
export const RATING_MIN_TENTHS = 0;
export const RATING_MAX_TENTHS = 100;

/**
 * Tolerance for the "lands on a tenth" check.
 *
 * Every value of the form t/10 for t in 0..100 multiplies back to an exact
 * integer in IEEE-754, so the slider and anything parsed from its string
 * value would pass an exact test. Accumulated arithmetic does not: adding 0.1
 * eighty-two times gives 8.199999999999987, which is plainly meant to be 8.2.
 * An API client computing a score that way should get their rating stored,
 * not a 400.
 *
 * The gap between adjacent valid scores is a whole tenth, so a tolerance this
 * small cannot let a genuinely off-step value through.
 */
const EPSILON = 1e-6;

/** True when `score` is on the 0–10 scale and lands on a tenth. */
export function isValidRating(score: number): boolean {
  if (!Number.isFinite(score)) return false;
  if (score < RATING_MIN || score > RATING_MAX) return false;
  const tenths = score * 10;
  return Math.abs(tenths - Math.round(tenths)) < EPSILON;
}

/**
 * Convert a 0–10 display score to the 0–100 tenths stored in D1.
 * @throws RangeError if the score is not a valid rating.
 */
export function toTenths(score: number): number {
  if (!isValidRating(score)) {
    throw new RangeError(
      `Rating must be between ${RATING_MIN} and ${RATING_MAX} in steps of ${RATING_STEP}; received ${score}`,
    );
  }
  return Math.round(score * 10);
}

/** Convert stored tenths back to the 0–10 display scale. */
export function fromTenths(tenths: number): number {
  return Math.round(tenths) / 10;
}

/**
 * Format a score for display: "8", "8.2", or an em dash when unrated.
 * Whole numbers deliberately drop the ".0" so cards stay visually quiet.
 */
export function formatRating(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return "—";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/**
 * Average an array of stored tenths, returned on the 0–10 scale and rounded
 * to one decimal place. Returns null for an empty array, which is how "no
 * community rating yet" is represented throughout the app.
 */
export function averageFromTenths(tenths: readonly number[]): number | null {
  if (tenths.length === 0) return null;
  const total = tenths.reduce((sum, value) => sum + value, 0);
  return Math.round(total / tenths.length) / 10;
}
