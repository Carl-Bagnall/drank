/**
 * Display formatting shared across pages.
 *
 * Kept out of components so that "how a country code is shown" has one
 * answer, rather than each screen inventing its own.
 */

/** Turns a stored enum value like `ginger_beer` into `Ginger beer`. */
export function humanise(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Turns an ISO 3166-1 alpha-2 code into a country name.
 *
 * Uses the platform's own region data rather than a hand-maintained list.
 * Falls back to the raw code where Intl is unavailable or the code is not
 * recognised — showing "GB" is better than showing nothing.
 */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
