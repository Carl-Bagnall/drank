import { Hono } from "hono";
import type { AppEnv } from "../index";
import type { ApiError, PublicUser } from "../../shared/types";
import { hashPassword, verifyPassword } from "../auth/password";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  readSessionCookie,
  setSessionCookie,
} from "../auth/session";
import {
  readJsonObject,
  validateEmail,
  validateIdentifier,
  validatePassword,
  validateUsername,
} from "../validate";

export const auth = new Hono<AppEnv>();

/**
 * Deliberately identical for "no such account" and "wrong password".
 * Distinguishing them turns the login form into a way to discover which
 * email addresses and usernames have accounts.
 */
const INVALID_CREDENTIALS: ApiError = {
  error: "invalid_credentials",
  message: "Those details are not right.",
};

/**
 * A hash of a value nobody can supply. Verified against when no user matches,
 * so a request for an unknown account costs the same time as a real one and
 * cannot be distinguished by how quickly it fails.
 */
const DUMMY_HASH =
  "pbkdf2$sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

auth.post("/auth/register", async (c) => {
  const body = await readJsonObject(c.req.raw);
  const username = validateUsername(body);
  const email = validateEmail(body);
  const password = validatePassword(body);

  // Checked up front for a clear message. The unique indexes are still the
  // real guarantee — two simultaneous registrations would race past this.
  const existing = await c.env.DB.prepare(
    "SELECT username, email FROM users WHERE username = ? OR email = ?",
  )
    .bind(username, email)
    .first<{ username: string; email: string }>();

  if (existing) {
    const takenField =
      existing.username.toLowerCase() === username.toLowerCase()
        ? "username"
        : "email";
    const body: ApiError = {
      error: "already_exists",
      message:
        takenField === "username"
          ? "That username is taken."
          : "An account already exists for that email.",
    };
    return c.json(body, 409);
  }

  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
    )
      .bind(id, username, email, await hashPassword(password))
      .run();
  } catch (err) {
    // Only a uniqueness violation means "taken". Reporting every failure that
    // way told a user their brand-new username was taken when the real cause
    // was something else entirely, and swallowed the error that would have
    // explained it.
    const message = err instanceof Error ? err.message : String(err);
    const isDuplicate =
      message.includes("UNIQUE") || message.includes("constraint failed");

    if (!isDuplicate) {
      console.error("Registration failed:", message);
      throw err;
    }

    // The unique index fired — someone registered the same details in the
    // gap between the check above and this insert.
    const body: ApiError = {
      error: "already_exists",
      message: "That username or email is already taken.",
    };
    return c.json(body, 409);
  }

  setSessionCookie(c, await createSession(c.env.DB, id));

  const row = await c.env.DB.prepare(
    "SELECT id, username, display_name, created_at FROM users WHERE id = ?",
  )
    .bind(id)
    .first<UserRow>();

  return c.json({ user: toPublicUser(row!) }, 201);
});

/**
 * Sign in with either an email address or a username.
 *
 * One bind value is checked against both columns. That is unambiguous because
 * usernames are restricted to letters, digits and underscores, so a value
 * containing `@` can only ever be an email and a value without one can only
 * ever be a username — the two spaces cannot collide.
 *
 * Both columns are `COLLATE NOCASE` and uniquely indexed, so the match is
 * case-insensitive without any lowering here.
 */
auth.post("/auth/login", async (c) => {
  const body = await readJsonObject(c.req.raw);
  const identifier = validateIdentifier(body);
  const password = validatePassword(body);

  const row = await c.env.DB.prepare(
    `SELECT id, username, display_name, created_at, password_hash
     FROM users
     WHERE email = ? OR username = ?`,
  )
    .bind(identifier, identifier)
    .first<UserRow & { password_hash: string }>();

  const matches = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !matches) {
    return c.json(INVALID_CREDENTIALS, 401);
  }

  setSessionCookie(c, await createSession(c.env.DB, row.id));
  return c.json({ user: toPublicUser(row) });
});

auth.post("/auth/logout", async (c) => {
  await deleteSession(c.env.DB, readSessionCookie(c));
  clearSessionCookie(c);
  return c.json({ ok: true });
});
