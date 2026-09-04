/**
 * Types shared by the Worker API and the React client.
 *
 * This module is the contract between the two halves of the app. It must not
 * import from `src/client` or `src/worker`, and must not use DOM or Workers
 * globals, so that both sides can compile against it.
 */

export type DrinkStatus = "published" | "hidden" | "merged";

export type Packaging =
  | "can"
  | "bottle_glass"
  | "bottle_plastic"
  | "carton"
  | "pouch"
  | "other";

export type CaffeineStatus = "caffeinated" | "caffeine_free" | "unknown";

export type SugarStatus =
  | "full_sugar"
  | "reduced_sugar"
  | "zero_sugar"
  | "unknown";

/**
 * A drink in the global catalogue.
 *
 * Only `id`, `name`, `brand` and the timestamps are guaranteed. Everything
 * else is nullable by design: a user-contributed drink may be little more
 * than a name and a brand, and the catalogue must accept that.
 */
export interface Drink {
  id: string;
  name: string;
  brand: string;
  flavour: string | null;
  category: string | null;
  /** ISO 3166-1 alpha-2, e.g. "GB". */
  country: string | null;
  region: string | null;
  volumeMl: number | null;
  packaging: Packaging | null;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  caffeineStatus: CaffeineStatus | null;
  sugarStatus: SugarStatus | null;
  status: DrinkStatus;
  externalSource: string | null;
  externalSourceId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Community rating for a drink, computed on demand rather than stored.
 * `average` is on the 0–10 display scale, or null when nobody has rated it.
 */
export interface CommunityRating {
  average: number | null;
  count: number;
}

/** A drink as it appears in a grid or search result. */
export interface DrinkSummary {
  id: string;
  name: string;
  brand: string;
  flavour: string | null;
  imageUrl: string | null;
  community: CommunityRating;
  /** Null when the request is unauthenticated. */
  viewerRating: number | null;
  inViewerCollection: boolean;
}

export interface CollectionEntry {
  id: string;
  drinkId: string;
  addedAt: string;
  notes: string | null;
  isFavourite: boolean;
}

export interface CollectionStats {
  drinkCount: number;
  brandCount: number;
  countryCount: number;
  /** Mean of the viewer's own ratings on the 0–10 scale, or null. */
  averageRating: number | null;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: string;
}

/** Uniform error shape returned by every API route. */
export interface ApiError {
  error: string;
  message: string;
}

export interface Paginated<T> {
  items: T[];
  /** Opaque cursor for the next page, or null when the list is exhausted. */
  nextCursor: string | null;
}
