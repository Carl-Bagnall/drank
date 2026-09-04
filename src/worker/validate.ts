/**
 * Small validation helpers for request bodies.
 *
 * Deliberately hand-rolled rather than pulling in a schema library: every
 * payload in this phase is a handful of scalar fields, and the brief asks not
 * to add dependencies without a reason. If the add-a-drink payload (ten-plus
 * optional fields with cross-field rules) lands and this starts to sprawl,
 * that is the point to reach for Zod.
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
