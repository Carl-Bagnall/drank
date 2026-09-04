import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

/**
 * Session management.
 *
 * Sessions are rows in D1 rather than signed stateless tokens, so logout and
 * "sign out everywhere" revoke access immediately rather than waiting for an
 * expiry to elapse.
 *
 * The cookie holds a random token; the database stores only its SHA-256
 * hash. A leaked database therefore cannot be replayed as a set of live
 * sessions.
 */

export const SESSION_COOKIE = "drank_session";
const SESSION_DAYS = 30;
const TOKEN_BYTES = 32;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string | null;
  createdAt: string;
}

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** Hex SHA-256, matching the 64-character CHECK on sessions.id. */
async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function expiryDate(): string {
  return new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
}

/** Creates a session row and returns the raw token for the cookie. */
export async function createSession(
  db: D1Database,
  userId: string,
): Promise<string> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));

  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await hashToken(token), userId, expiryDate())
    .run();

  return token;
}

/**
 * Resolves the signed-in user, or null.
 *
 * Expired rows are deleted as they are encountered, which keeps the table
 * tidy without needing a scheduled job for a project this size.
 */
export async function getSessionUser(
  db: D1Database,
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;

  const id = await hashToken(token);
  const row = await db
    .prepare(
      `SELECT s.expires_at, u.id, u.username, u.display_name, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .bind(id)
    .first<{
      expires_at: string;
      id: string;
      username: string;
      display_name: string | null;
      created_at: string;
    }>();

  if (!row) return null;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export async function deleteSession(
  db: D1Database,
  token: string | undefined,
): Promise<void> {
  if (!token) return;
  await db
    .prepare("DELETE FROM sessions WHERE id = ?")
    .bind(await hashToken(token))
    .run();
}

/** Removes every session for a user — used when the password changes. */
export async function deleteAllSessions(
  db: D1Database,
  userId: string,
): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
}

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

/**
 * `httpOnly` keeps the token away from any injected script; `sameSite: Lax`
 * means the browser will not attach it to cross-site POSTs, which is what
 * stops a CSRF form submission from acting as the user.
 *
 * `secure` follows the request protocol rather than the hostname. Browsers
 * silently discard a Secure cookie delivered over plain HTTP, so keying this
 * off `hostname === "localhost"` broke every other way of reaching a dev
 * server — 127.0.0.1, and the LAN address used to test on a real phone. The
 * symptom was a successful sign-in that immediately bounced back to signed
 * out, because the cookie was thrown away before the next request.
 *
 * Production is served over HTTPS, so this still sets Secure there.
 */
export function setSessionCookie(c: Context, token: string): void {
  const isHttps = new URL(c.req.url).protocol === "https:";

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}
