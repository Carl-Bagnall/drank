import { Link } from "react-router";
import type { DrinkSummary } from "../../shared/types";
import { DrinkImage } from "./DrinkImage";
import { RatingPip } from "./Rating";

/**
 * A single drink in a grid.
 *
 * The whole card is one link, so the tap target is the card rather than the
 * title alone — the app is meant to be used one-handed.
 */
export function DrinkCard({ drink }: { drink: DrinkSummary }) {
  return (
    <Link
      to={`/drinks/${drink.id}`}
      className="sticker block overflow-hidden transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
    >
      <div className="relative border-b-[2.5px] border-ink">
        <DrinkImage
          drinkId={drink.id}
          name={drink.name}
          brand={drink.brand}
          category={drink.category}
          imageUrl={drink.imageUrl}
        />
        <span className="absolute bottom-1.5 right-1.5">
          <RatingPip score={drink.community.average} />
        </span>
      </div>

      <div className="px-2.5 py-2">
        <p className="truncate text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-muted">
          {drink.brand}
        </p>
        <h3 className="mt-0.5 line-clamp-2 text-sm leading-tight text-ink">
          {drink.name}
        </h3>
        {drink.flavour && (
          <p className="mt-1 truncate text-xs font-medium text-ink-muted">
            {drink.flavour}
          </p>
        )}
      </div>
    </Link>
  );
}
