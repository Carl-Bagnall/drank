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
      className="sticker flex h-full flex-col overflow-hidden transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
    >
      <div className="relative shrink-0 border-b-[2.5px] border-ink">
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

      {/* flex-1 lets the text block absorb the leftover height so the card's
          bottom edge is flush with its neighbours. */}
      <div className="flex flex-1 flex-col px-2.5 py-2">
        <p className="truncate text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-muted">
          {drink.brand}
        </p>
        {/* Always reserves two lines, so a one-line name does not pull the
            flavour up and misalign it against neighbouring cards. */}
        <h3 className="mt-0.5 line-clamp-2 min-h-[2lh] text-sm leading-tight text-ink">
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
