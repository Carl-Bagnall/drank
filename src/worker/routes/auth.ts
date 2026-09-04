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
  validatePassword,
  validateUsername,
} from "../validate";

export const auth = new Hono<AppEnv>();

/**
 * Deliberately identical for "no such email" and "wrong password".
 * Distinguishing them turns the login form into a way to discover which
 * email addresses have accounts.
 */
const INVALID_CREDENTIALS: ApiError = {
  error: "invalid_credentials",
  message: "That email or password is not right.",
};

/**
 * A hash of a value nobody can supply. Verified against when no user matches,
 * so a request for an unknown email costs the same time as a real one and
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
  } catch {
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

auth.post("/auth/login", async (c) => {
  const body = await readJsonObject(c.req.raw);
  const email = validateEmail(body);
  const password = validatePassword(body);

  const row = await c.env.DB.prepare(
    "SELECT id, username, display_name, created_at, password_hash FROM users WHERE email = ?",
  )
    .bind(email)
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
