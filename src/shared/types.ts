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
  category: string | null;
  imageUrl: string | null;
  community: CommunityRating;
  /** Null when the request is unauthenticated. */
  viewerRating: number | null;
  inViewerCollection: boolean;
}

/**
 * A drink in someone's collection: the drink itself, plus that person's own
 * entry. The rating is joined from `ratings`, never stored on the entry, so
 * owning a drink and scoring it stay separate.
 */
export interface CollectionItem extends DrinkSummary {
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

/** One filter option and how many drinks carry it. */
export interface Facet {
  value: string;
  count: number;
}

export interface Facets {
  categories: Facet[];
  countries: Facet[];
  brands: Facet[];
}

/** Response shape of GET /api/drinks. */
export interface DrinkListResponse {
  items: DrinkSummary[];
  total: number;
  /** Opaque; pass back as `cursor`. Null when the list is exhausted. */
  nextCursor: string | null;
}

/** Response shape of GET /api/drinks/:id. */
export interface DrinkDetailResponse {
  drink: Drink;
  community: CommunityRating;
  /** Other drinks from the same brand — the variant family. */
  siblings: DrinkSummary[];
  viewerRating: number | null;
  inViewerCollection: boolean;
  /** The viewer's own notes and favourite flag, or null if not collected. */
  viewerEntry: { notes: string | null; isFavourite: boolean } | null;
}

/** Response shape of GET /api/users/me. */
export interface MeResponse {
  user: PublicUser;
  stats: CollectionStats;
}

/** Response shape of GET /api/users/me/collection. */
export interface CollectionListResponse {
  items: CollectionItem[];
  total: number;
  nextCursor: string | null;
  stats: CollectionStats;
}

/** Response shape of the register and login routes. */
export interface AuthResponse {
  user: PublicUser;
}

/** Response shape of POST and DELETE /api/drinks/:id/rating. */
export interface RatingResponse {
  viewerRating: number | null;
  community: CommunityRating;
}

/** Response shape of GET /api/drinks/:id/ratings. */
export interface RatingBreakdownResponse {
  community: CommunityRating;
  /** Counts per whole-number band, 0–10. */
  distribution: { score: number; count: number }[];
}
