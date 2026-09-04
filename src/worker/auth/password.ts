/**
 * Password hashing.
 *
 * PBKDF2-HMAC-SHA-256 via WebCrypto. bcrypt, scrypt and Argon2 are the
 * stronger choices, but none are available in workerd without shipping WASM;
 * PBKDF2 is the strongest primitive the runtime offers natively, and the
 * brief asks not to add dependencies without reason.
 *
 * The algorithm, iteration count and salt are stored alongside the hash, so
 * the cost can be raised later without invalidating existing passwords —
 * old hashes keep verifying with their own recorded parameters.
 */

/**
 * OWASP recommends 600,000 iterations for PBKDF2-HMAC-SHA-256. That exceeds
 * the 10ms CPU budget of a free-tier Worker request, so this sits lower
 * deliberately. Raise it when the app runs on a paid plan: existing hashes
 * carry their own count and keep working.
 */
const ITERATIONS = 210_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    KEY_BITS,
  );

  return new Uint8Array(bits);
}

/** Compares in constant time, so a mismatch position cannot be timed. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a[i]! ^ b[i]!;
  }
  return difference === 0;
}

/** Returns `pbkdf2$sha256$<iterations>$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Verifies a password against a stored hash.
 *
 * Returns false rather than throwing for malformed or unknown-format hashes:
 * the seed data deliberately stores an unusable placeholder, and a login
 * attempt against one of those accounts must simply fail.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 5) return false;

  const [scheme, digest, iterationsRaw, saltRaw, hashRaw] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (scheme !== "pbkdf2" || digest !== "sha256") return false;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  try {
    const salt = fromBase64(saltRaw);
    const expected = fromBase64(hashRaw);
    const actual = await derive(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
