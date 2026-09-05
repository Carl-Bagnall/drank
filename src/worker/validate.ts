/**
 * Small validation helpers for request bodies.
 *
 * Deliberately hand-rolled rather than pulling in a schema library, and the
 * brief asks not to add dependencies without a reason.
 *
 * An earlier note here said the add-a-drink payload would be the point to
 * reach for Zod. That payload has now landed, and the trade did not tip: its
 * twelve fields are each an independent scalar rule, which is what these
 * helpers already express, and several carry app-specific behaviour a schema
 * would not (rejecting non-http image URLs, upper-casing country codes,
 * treating empty strings as absent).
 *
 * What would tip it: nested objects, arrays of objects, or rules that span
 * fields. None of those exist yet.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Parses a JSON object body, rejecting arrays, null and malformed JSON. */
export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

export function requireString(
  body: Record<string, unknown>,
  field: string,
  { min = 1, max = 255 }: { min?: number; max?: number } = {},
): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new ValidationError(`${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throw new ValidationError(
      min === 1
        ? `${field} is required.`
        : `${field} must be at least ${min} characters.`,
    );
  }
  if (trimmed.length > max) {
    throw new ValidationError(`${field} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
  { max = 255 }: { max?: number } = {},
): string | null {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be text.`);
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > max) {
    throw new ValidationError(`${field} must be ${max} characters or fewer.`);
  }
  return trimmed;
}

export function optionalBoolean(
  body: Record<string, unknown>,
  field: string,
): boolean | null {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") {
    throw new ValidationError(`${field} must be true or false.`);
  }
  return value;
}

/**
 * Username rules: letters, digits and underscores. Kept narrow so usernames
 * stay unambiguous in URLs and cannot be confused with one another through
 * lookalike characters.
 */
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

export function validateUsername(body: Record<string, unknown>): string {
  const username = requireString(body, "username", { min: 2, max: 32 });
  if (!USERNAME_PATTERN.test(username)) {
    throw new ValidationError(
      "Username may only contain letters, numbers and underscores.",
    );
  }
  return username;
}

/**
 * A deliberately permissive email check. Full RFC validation rejects valid
 * addresses and accepts unusable ones; the only real proof an address works
 * is sending to it, which is a later concern.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function validateEmail(body: Record<string, unknown>): string {
  const email = requireString(body, "email", { min: 3, max: 254 });
  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError("Enter a valid email address.");
  }
  return email.toLowerCase();
}

/**
 * The login identifier: either an email address or a username.
 *
 * Deliberately not validated as one or the other. Usernames cannot contain
 * `@` (see USERNAME_PATTERN), so the two spaces cannot overlap and the query
 * can simply check both columns. Rejecting a malformed email here would also
 * leak that the input was being treated as an email at all.
 */
export function validateIdentifier(body: Record<string, unknown>): string {
  const value = body["identifier"];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError("Enter your email address or username.");
  }
  const trimmed = value.trim();
  if (trimmed.length > 254) {
    throw new ValidationError("That email address or username is too long.");
  }
  return trimmed;
}

/**
 * Length is the only rule. Composition requirements (a digit, a symbol) push
 * people towards predictable substitutions and are no longer recommended;
 * NIST guidance is to check length and screen against breached passwords.
 */
export function validatePassword(body: Record<string, unknown>): string {
  const value = body["password"];
  if (typeof value !== "string") {
    throw new ValidationError("password is required.");
  }
  if (value.length < 8) {
    throw new ValidationError("Password must be at least 8 characters.");
  }
  if (value.length > 128) {
    throw new ValidationError("Password must be 128 characters or fewer.");
  }
  return value;
}

/** Categories the catalogue recognises. Free text would fragment the facets. */
export const DRINK_CATEGORIES = [
  "cola",
  "lemonade",
  "citrus",
  "fruit",
  "energy",
  "ginger_beer",
  "other",
] as const;

export const PACKAGING_TYPES = [
  "can",
  "bottle_glass",
  "bottle_plastic",
  "carton",
  "pouch",
  "other",
] as const;

export function optionalEnum(
  body: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
): string | null {
  const value = optionalString(body, field, { max: 40 });
  if (value === null) return null;
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

/** ISO 3166-1 alpha-2, upper-cased. */
export function optionalCountry(body: Record<string, unknown>): string | null {
  const value = optionalString(body, "country", { max: 2 });
  if (value === null) return null;
  if (!/^[A-Za-z]{2}$/.test(value)) {
    throw new ValidationError("country must be a two-letter country code.");
  }
  return value.toUpperCase();
}

export function optionalPositiveInt(
  body: Record<string, unknown>,
  field: string,
  max: number,
): number | null {
  const value = body[field];
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    throw new ValidationError(
      `${field} must be a whole number between 1 and ${max}.`,
    );
  }
  return parsed;
}

/**
 * An image URL that is safe to put in an `src`.
 *
 * Only http and https are accepted. Rejecting every other scheme keeps
 * `javascript:`, `data:` and `blob:` out of the database rather than relying
 * on each render site to be careful.
 */
export function optionalImageUrl(body: Record<string, unknown>): string | null {
  const value = optionalString(body, "imageUrl", { max: 2000 });
  if (value === null) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError("imageUrl must be a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ValidationError("imageUrl must start with http:// or https://.");
  }
  return url.toString();
}

/** A barcode, when one is supplied. Optional everywhere by design. */
export function optionalBarcode(body: Record<string, unknown>): string | null {
  const value = optionalString(body, "barcode", { max: 14 });
  if (value === null) return null;
  if (!/^\d{8,14}$/.test(value)) {
    throw new ValidationError("A barcode is 8 to 14 digits.");
  }
  return value;
}
