import type { ApiError } from "../shared/types";

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

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
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
