/**
 * External product data.
 *
 * The catalogue is the source of truth. A provider only ever *suggests*
 * values for a drink somebody is about to create — nothing here writes to the
 * database, and a provider being down must never stop a drink being added.
 *
 * The interface exists so Open Food Facts can be swapped or joined by another
 * source without touching the routes or the UI.
 */

/** What a provider can tell us about a barcode. Every field is optional. */
export interface ProductSuggestion {
  barcode: string;
  name: string | null;
  brand: string | null;
  volumeMl: number | null;
  /** ISO 3166-1 alpha-2 where it could be determined. */
  country: string | null;
  imageUrl: string | null;
  /** Which provider answered, for `drinks.external_source`. */
  source: string;
  /** The provider's own id for this product. */
  sourceId: string;
}

export type LookupResult =
  | { status: "found"; suggestion: ProductSuggestion }
  | { status: "not_found" }
  /**
   * The provider failed. Deliberately distinct from `not_found`: the UI
   * offers manual entry either way, but only this one is worth logging, and
   * only this one should avoid being cached as a negative result.
   */
  | { status: "unavailable"; reason: string };

export interface ProductDataProvider {
  /** Stable identifier, stored on any drink created from this provider. */
  readonly name: string;
  lookupByBarcode(barcode: string): Promise<LookupResult>;
}

/**
 * Barcodes are digit strings of 8–14 characters (EAN-8 through GTIN-14).
 *
 * Validated before any outbound request so a malformed value cannot be used
 * to build a URL against the provider.
 */
export function isValidBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value.trim());
}

/**
 * Parses a quantity string like "330 ml", "1.5 l", "33cl" into millilitres.
 *
 * Open Food Facts stores this as free text, so this is best-effort by nature:
 * anything unrecognised returns null and the field is simply left for the
 * user to fill in.
 */
export function parseVolumeMl(quantity: string | null | undefined): number | null {
  if (!quantity) return null;

  const match = /(\d+(?:[.,]\d+)?)\s*(ml|cl|l|litre|liter)\b/i.exec(quantity);
  if (!match) return null;

  const amount = Number(match[1]!.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const unit = match[2]!.toLowerCase();
  const millilitres =
    unit === "ml" ? amount : unit === "cl" ? amount * 10 : amount * 1000;

  const rounded = Math.round(millilitres);
  // Guards against nonsense like "12 x 330 ml" parsing into something absurd.
  return rounded > 0 && rounded <= 10_000 ? rounded : null;
}
