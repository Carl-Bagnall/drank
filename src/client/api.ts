import type {
  ApiError,
  AuthResponse,
  BarcodeLookupResponse,
  CollectionItem,
  CollectionListResponse,
  CollectionStatus,
  DrinkDetailResponse,
  DrinkListResponse,
  Facets,
  MeResponse,
  NewDrinkInput,
  RatingBreakdownResponse,
  RatingResponse,
} from "../shared/types";

/**
 * Thin fetch wrapper for the Drank API.
 *
 * Components never call `fetch` directly — they go through here — so that
 * error shape, credential handling and base path stay in one place. This is
 * also the seam where auth headers and caching will land in later phases.
 */

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  /**
   * The rest of the error body.
   *
   * Some errors carry more than a message — a registration conflict names the
   * field that clashed, so the form can mark and focus that input rather than
   * showing a banner the user has to map back to a field themselves.
   */
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    // Sessions will be cookie-based, so send credentials from the start.
    credentials: "same-origin",
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiRequestError(
        response.status,
        "invalid_response",
        "The server returned a response that was not valid JSON.",
      );
    }
  }

  if (!response.ok) {
    const err = body as ApiError | null;
    throw new ApiRequestError(
      response.status,
      err?.error ?? "unknown_error",
      err?.message ?? `Request failed with status ${response.status}.`,
      (body as Record<string, unknown>) ?? {},
    );
  }

  return body as T;
}

export interface HealthResponse {
  status: string;
  database: string;
  publishedDrinks: number;
  latencyMs: number;
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

export interface DrinkQuery {
  q?: string;
  brand?: string;
  category?: string;
  country?: string;
  sort?: "recent" | "rating" | "name";
  limit?: number;
  cursor?: string;
}

/** Builds the query string, omitting empty values so URLs stay readable. */
function toSearchParams(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function getDrinks(
  query: DrinkQuery = {},
  signal?: AbortSignal,
): Promise<DrinkListResponse> {
  return apiFetch<DrinkListResponse>(
    `/drinks${toSearchParams(query as Record<string, unknown>)}`,
    { signal },
  );
}

export function getDrink(
  id: string,
  signal?: AbortSignal,
): Promise<DrinkDetailResponse> {
  return apiFetch<DrinkDetailResponse>(`/drinks/${encodeURIComponent(id)}`, {
    signal,
  });
}

export function getFacets(signal?: AbortSignal): Promise<Facets> {
  return apiFetch<Facets>("/drinks/facets", { signal });
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export function register(input: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: {
  /** Email address or username. */
  identifier: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export function getMe(signal?: AbortSignal): Promise<MeResponse> {
  return apiFetch<MeResponse>("/users/me", { signal });
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

export interface CollectionQuery {
  status?: CollectionStatus;
  sort?: "recent" | "highest" | "lowest" | "name";
  brand?: string;
  category?: string;
  country?: string;
  favourites?: boolean;
  limit?: number;
  cursor?: string;
}

export function getCollection(
  query: CollectionQuery = {},
  signal?: AbortSignal,
): Promise<CollectionListResponse> {
  return apiFetch<CollectionListResponse>(
    `/users/me/collection${toSearchParams(query as Record<string, unknown>)}`,
    { signal },
  );
}

export function getCollectionFacets(signal?: AbortSignal): Promise<Facets> {
  return apiFetch<Facets>("/users/me/collection/facets", { signal });
}

export function getFavourites(
  signal?: AbortSignal,
): Promise<{ items: CollectionItem[] }> {
  return apiFetch<{ items: CollectionItem[] }>("/users/me/favourites", { signal });
}

export interface AddToCollectionResult {
  drinkId: string;
  status: CollectionStatus;
  outcome: "added" | "moved" | "unchanged";
}

export function addToCollection(
  drinkId: string,
  status: CollectionStatus = "collected",
): Promise<AddToCollectionResult> {
  return apiFetch("/users/me/collection", {
    method: "POST",
    body: JSON.stringify({ drinkId, status }),
  });
}

export function removeFromCollection(drinkId: string): Promise<{ removed: boolean }> {
  return apiFetch(`/users/me/collection/${encodeURIComponent(drinkId)}`, {
    method: "DELETE",
  });
}

export function updateCollectionEntry(
  drinkId: string,
  changes: { notes?: string | null; isFavourite?: boolean },
): Promise<unknown> {
  return apiFetch(`/users/me/collection/${encodeURIComponent(drinkId)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/** Sets the signed-in user's score (0–10, half points). Upserts. */
export function setRating(drinkId: string, score: number): Promise<RatingResponse> {
  return apiFetch<RatingResponse>(
    `/drinks/${encodeURIComponent(drinkId)}/rating`,
    { method: "POST", body: JSON.stringify({ score }) },
  );
}

export function deleteRating(drinkId: string): Promise<RatingResponse> {
  return apiFetch<RatingResponse>(
    `/drinks/${encodeURIComponent(drinkId)}/rating`,
    { method: "DELETE" },
  );
}

export function getRatingBreakdown(
  drinkId: string,
  signal?: AbortSignal,
): Promise<RatingBreakdownResponse> {
  return apiFetch<RatingBreakdownResponse>(
    `/drinks/${encodeURIComponent(drinkId)}/ratings`,
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Products and contributions
// ---------------------------------------------------------------------------

export function lookupBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<BarcodeLookupResponse> {
  return apiFetch<BarcodeLookupResponse>(
    `/products/barcode/${encodeURIComponent(barcode)}`,
    { signal },
  );
}

export function createDrink(input: NewDrinkInput): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/drinks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getBrandDrinks(
  brand: string,
  signal?: AbortSignal,
): Promise<{ items: { id: string; name: string; brand: string }[] }> {
  return apiFetch(`/brands/${encodeURIComponent(brand)}/drinks`, { signal });
}
