import { formatRating } from "../../shared/rating";

/**
 * Rating display.
 *
 * The brief requires "your rating" and "community rating" to read as clearly
 * separate things, so the label is always rendered alongside the score rather
 * than being implied by position or colour.
 */

interface RatingBadgeProps {
  score: number | null;
  /** Number of ratings behind a community score. Omitted for a personal one. */
  count?: number;
  label: string;
  tone?: string;
  size?: "sm" | "lg";
}

export function RatingBadge({
  score,
  count,
  label,
  tone = "bg-citrus",
  size = "sm",
}: RatingBadgeProps) {
  const isLarge = size === "lg";
  const unrated = score === null;

  return (
    <div
      className={[
        "sticker-sm inline-flex flex-col items-start",
        isLarge ? "px-3.5 py-2" : "px-2.5 py-1.5",
        // An unrated drink is deliberately neutral rather than coloured, so a
        // grid does not imply every drink has been scored.
        unrated ? "bg-sunken" : tone,
      ].join(" ")}
    >
      <span className="text-[0.5625rem] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </span>
      <span className="flex items-baseline gap-1 text-ink">
        <span className={`font-display leading-none ${isLarge ? "text-2xl" : "text-sm"}`}>
          {formatRating(score)}
        </span>
        {!unrated && (
          <span className={`font-medium ${isLarge ? "text-xs" : "text-[0.625rem]"}`}>
            / 10
          </span>
        )}
      </span>
      {count !== undefined && (
        <span className="text-[0.5625rem] font-medium text-ink-muted">
          {count === 0
            ? "No ratings yet"
            : `${count.toLocaleString("en-GB")} ${count === 1 ? "rating" : "ratings"}`}
        </span>
      )}
    </div>
  );
}

/**
 * A compact score for use on cards, where a full badge would crowd the
 * layout. Includes a visually hidden label so it is not just a bare number
 * to a screen reader.
 */
export function RatingPip({ score }: { score: number | null }) {
  const unrated = score === null;

  return (
    <span
      className={[
        "sticker-sm inline-flex items-center gap-0.5 px-1.5 py-0.5 font-display text-xs text-ink",
        unrated ? "bg-sunken" : "bg-citrus",
      ].join(" ")}
    >
      <span className="sr-only">Community rating: </span>
      {unrated ? "—" : formatRating(score)}
      {!unrated && <span className="sr-only"> out of 10</span>}
    </span>
  );
}
