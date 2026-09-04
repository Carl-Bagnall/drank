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
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {drinks.map((drink) => (
        <li key={drink.id}>
          <DrinkCard drink={drink} />
        </li>
      ))}
    </ul>
  );
}
