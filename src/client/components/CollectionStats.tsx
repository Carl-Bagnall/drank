import type { CollectionStats as Stats } from "../../shared/types";
import { formatRating } from "../../shared/rating";

/**
 * The headline numbers for a collection, as a row of sticker tiles.
 *
 * Deliberately four small facts rather than a dashboard — the brief asks for
 * something collectible, not a set of KPIs.
 */
export function CollectionStats({ stats }: { stats: Stats }) {
  const tiles: { label: string; value: string; tone: string }[] = [
    { label: "Drinks", value: String(stats.drinkCount), tone: "bg-cherry" },
    { label: "Brands", value: String(stats.brandCount), tone: "bg-citrus" },
    { label: "Countries", value: String(stats.countryCount), tone: "bg-fizz" },
    {
      label: "Avg rating",
      value: formatRating(stats.averageRating),
      tone: "bg-berry",
    },
  ];

  return (
    <dl className="grid grid-cols-4 gap-2">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={`sticker-sm flex flex-col items-center justify-center px-1 py-2.5 ${tile.tone}`}
        >
          <dd className="font-display text-lg leading-none text-ink">{tile.value}</dd>
          <dt className="mt-1 text-center text-[0.5625rem] font-semibold uppercase tracking-wide text-ink">
            {tile.label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
