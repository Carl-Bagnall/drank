import type { DrinkSummary } from "../../shared/types";
import { DrinkCard } from "./DrinkCard";

/**
 * Responsive grid of drinks. Two columns on a phone, three once there is room
 * — the cards stay large enough to read the product at a glance, which is the
 * point of an image-led catalogue.
 */
export function DrinkGrid({
  drinks,
  label,
}: {
  drinks: DrinkSummary[];
  /** Accessible name for the list, e.g. "Search results". */
  label: string;
}) {
  return (
    // `auto-rows-fr` gives every row the same height, so cards line up across
    // the whole grid rather than only within a row. Combined with `h-full` on
    // the card itself, that fixes the ragged bottom edge caused by names
    // wrapping to two lines and flavour being optional — without hard-coding
    // a pixel height that would break when the user scales their text.
    <ul
      aria-label={label}
      className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {drinks.map((drink) => (
        <li key={drink.id} className="h-full">
          <DrinkCard drink={drink} />
        </li>
      ))}
    </ul>
  );
}
