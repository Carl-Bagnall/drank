import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  AuthResponse,
  CollectionListResponse,
  DrinkDetailResponse,
  MeResponse,
} from "../src/shared/types";
import { hashPassword, verifyPassword } from "../src/worker/auth/password";

const BASE = "https://drank.test/api";
const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * SELF.fetch does not keep a cookie jar, so sessions are carried by hand.
 * That is a fair reflection of what the browser does, and it keeps each test
 * explicit about which identity it is acting as.
 */
function sessionCookie(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  return header.split(";")[0] ?? "";
}

async function register(
  username = "carl",
  email = "carl@example.com",
  password = "correct horse battery",
) {
  const response = await SELF.fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, email, password }),
  });
  return { response, cookie: sessionCookie(response) };
}

async function insertDrink(id: string, name: string, brand: string) {
  await env.DB.prepare(
    `INSERT INTO drinks (id, name, brand, brand_normalised, category, country)
     VALUES (?, ?, ?, ?, 'cola', 'GB')`,
  )
    .bind(id, name, brand, brand.toLowerCase())
    .run();
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM ratings"),
    env.DB.prepare("DELETE FROM collection_entries"),
    env.DB.prepare("DELETE FROM drinks"),
    env.DB.prepare("DELETE FROM users"),
  ]);
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("Correct horse battery", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same password", a)).toBe(true);
    expect(await verifyPassword("same password", b)).toBe(true);
  });

  it("records its parameters so the cost can be raised later", async () => {
    const hash = await hashPassword("whatever");
    expect(hash.startsWith("pbkdf2$sha256$")).toBe(true);
    expect(hash.split("$")).toHaveLength(5);
  });

  it("returns false rather than throwing for unusable stored hashes", async () => {
    // The seed data stores exactly this placeholder.
    expect(await verifyPassword("anything", "seed-no-login")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$x$y$z$w")).toBe(false);
  });
});

describe("registration", () => {
  it("creates an account and signs the user in", async () => {
    const { response, cookie } = await register();
    expect(response.status).toBe(201);

    const body = await response.json<AuthResponse>();
    expect(body.user.username).toBe("carl");
    expect(cookie).toContain("drank_session=");

    const me = await SELF.fetch(`${BASE}/users/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    expect((await me.json<MeResponse>()).user.username).toBe("carl");
  });

  it("never stores the password in plain text", async () => {
    await register();
    const row = await env.DB.prepare(
      "SELECT password_hash FROM users WHERE username = 'carl'",
    ).first<{ password_hash: string }>();

    expect(row?.password_hash).not.toContain("correct horse battery");
    expect(row?.password_hash.startsWith("pbkdf2$")).toBe(true);
  });

  it("rejects a duplicate username or email", async () => {
    await register();

    const sameUsername = await SELF.fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        username: "carl",
        email: "other@example.com",
        password: "correct horse battery",
      }),
    });
    expect(sameUsername.status).toBe(409);

    const sameEmail = await SELF.fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        username: "other",
        email: "carl@example.com",
        password: "correct horse battery",
      }),
    });
    expect(sameEmail.status).toBe(409);
  });

  it("rejects invalid input", async () => {
    const cases = [
      { username: "a", email: "a@example.com", password: "longenough1" },
      { username: "has space", email: "a@example.com", password: "longenough1" },
      { username: "valid", email: "not-an-email", password: "longenough1" },
      { username: "valid", email: "a@example.com", password: "short" },
      { username: "valid", email: "a@example.com" },
    ];

    for (const payload of cases) {
      const response = await SELF.fetch(`${BASE}/auth/register`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      });
      expect(response.status, JSON.stringify(payload)).toBe(400);
    }
  });

  it("rejects a body that is not a JSON object", async () => {
    const response = await SELF.fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: "[]",
    });
    expect(response.status).toBe(400);
  });
});

describe("login and logout", () => {
  const attemptLogin = (identifier: string, password = "correct horse battery") =>
    SELF.fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ identifier, password }),
    });

  it("signs in with an email address", async () => {
    await register();
    const response = await attemptLogin("carl@example.com");

    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toContain("drank_session=");
  });

  it("signs in with a username", async () => {
    await register();
    const response = await attemptLogin("carl");

    expect(response.status).toBe(200);
    expect(sessionCookie(response)).toContain("drank_session=");
    expect((await response.json<AuthResponse>()).user.username).toBe("carl");
  });

  it("matches either identifier case-insensitively", async () => {
    await register();

    for (const identifier of ["CARL", "Carl@Example.COM", "cArL"]) {
      const response = await attemptLogin(identifier);
      expect(response.status, identifier).toBe(200);
    }
  });

  it("cannot confuse a username for someone else's email", async () => {
    // Usernames cannot contain "@", so the two identifier spaces are
    // disjoint by construction — this guards that rule at the API.
    const response = await SELF.fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        username: "carl@example.com",
        email: "someone@example.com",
        password: "correct horse battery",
      }),
    });
    expect(response.status).toBe(400);
  });

  it("gives the same answer for a wrong password, unknown email and unknown username", async () => {
    await register();

    const wrongPassword = await attemptLogin("carl@example.com", "wrong password");
    const unknownEmail = await attemptLogin("nobody@example.com", "wrong password");
    const unknownUsername = await attemptLogin("nobody", "wrong password");

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(unknownUsername.status).toBe(401);

    // Identical, so the form cannot be used to discover which emails or
    // usernames have accounts.
    const bodies = await Promise.all([
      wrongPassword.json(),
      unknownEmail.json(),
      unknownUsername.json(),
    ]);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    // And the message must not name which field was wrong.
    expect(JSON.stringify(bodies[0]).toLowerCase()).not.toContain("email");
    expect(JSON.stringify(bodies[0]).toLowerCase()).not.toContain("username");
  });

  it("rejects a missing or empty identifier", async () => {
    await register();

    for (const body of ['{"password":"correct horse battery"}', '{"identifier":"  ","password":"correct horse battery"}']) {
      const response = await SELF.fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: JSON_HEADERS,
        body,
      });
      expect(response.status, body).toBe(400);
    }
  });

  it("logout revokes the session immediately", async () => {
    const { cookie } = await register();

    const before = await SELF.fetch(`${BASE}/users/me`, { headers: { cookie } });
    expect(before.status).toBe(200);

    await SELF.fetch(`${BASE}/auth/logout`, { method: "POST", headers: { cookie } });

    const after = await SELF.fetch(`${BASE}/users/me`, { headers: { cookie } });
    expect(after.status).toBe(401);
  });

  it("marks the cookie Secure over HTTPS but not over plain HTTP", async () => {
    // Browsers silently discard a Secure cookie delivered over plain HTTP.
    // Keying this off the hostname rather than the protocol broke sign-in on
    // 127.0.0.1 and on the LAN address used to test from a phone: the cookie
    // was thrown away, so the very next request was unauthenticated.
    const secureResponse = await SELF.fetch("https://drank.test/api/auth/register", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        username: "https_user",
        email: "https@example.com",
        password: "correct horse battery",
      }),
    });
    const insecureResponse = await SELF.fetch("http://drank.test/api/auth/register", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        username: "http_user",
        email: "http@example.com",
        password: "correct horse battery",
      }),
    });

    expect(secureResponse.headers.get("set-cookie")).toContain("Secure");
    expect(insecureResponse.headers.get("set-cookie")).not.toContain("Secure");

    // The protections that do not depend on the transport must hold either way.
    for (const response of [secureResponse, insecureResponse]) {
      const header = response.headers.get("set-cookie") ?? "";
      expect(header).toContain("HttpOnly");
      expect(header).toContain("SameSite=Lax");
    }
  });

  it("stores only a hash of the session token, never the token", async () => {
    const { cookie } = await register();
    const token = cookie.split("=")[1]!;

    const row = await env.DB.prepare("SELECT id FROM sessions").first<{ id: string }>();
    expect(row?.id).not.toBe(token);
    expect(row?.id).toHaveLength(64);
  });

  it("ignores a forged session token", async () => {
    const response = await SELF.fetch(`${BASE}/users/me`, {
      headers: { cookie: "drank_session=not-a-real-token" },
    });
    expect(response.status).toBe(401);
  });
});

describe("collection", () => {
  it("requires authentication on every route", async () => {
    const requests: [string, RequestInit][] = [
      [`${BASE}/users/me`, {}],
      [`${BASE}/users/me/collection`, {}],
      [`${BASE}/users/me/favourites`, {}],
      [
        `${BASE}/users/me/collection`,
        { method: "POST", headers: JSON_HEADERS, body: '{"drinkId":"x"}' },
      ],
      [`${BASE}/users/me/collection/x`, { method: "DELETE" }],
      [
        `${BASE}/users/me/collection/x`,
        { method: "PATCH", headers: JSON_HEADERS, body: "{}" },
      ],
    ];

    for (const [url, init] of requests) {
      const response = await SELF.fetch(url, init);
      expect(response.status, url).toBe(401);
    }
  });

  it("adds a drink, and reports a repeat add rather than failing", async () => {
    const { cookie } = await register();
    await insertDrink("d1", "Coca-Cola Cherry", "Coca-Cola");

    const first = await SELF.fetch(`${BASE}/users/me/collection`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ drinkId: "d1" }),
    });
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ outcome: "added" });

    const second = await SELF.fetch(`${BASE}/users/me/collection`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ drinkId: "d1" }),
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ outcome: "unchanged" });

    // Still exactly one entry.
    const list = await SELF.fetch(`${BASE}/users/me/collection`, {
      headers: { cookie },
    });
    expect((await list.json<CollectionListResponse>()).total).toBe(1);
  });

  it("404s when adding a drink that does not exist", async () => {
    const { cookie } = await register();
    const response = await SELF.fetch(`${BASE}/users/me/collection`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ drinkId: "nope" }),
    });
    expect(response.status).toBe(404);
  });

  it("removes a drink, and 404s when it was never there", async () => {
    const { cookie } = await register();
    await insertDrink("d1", "Sprite", "Sprite");

    await SELF.fetch(`${BASE}/users/me/collection`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ drinkId: "d1" }),
    });

    const removed = await SELF.fetch(`${BASE}/users/me/collection/d1`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(removed.status).toBe(200);

    const again = await SELF.fetch(`${BASE}/users/me/collection/d1`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(again.status).toBe(404);
  });

  it("keeps one user's collection private from another", async () => {
    const carl = await register("carl", "carl@example.com");
    const ally = await register("ally", "ally@example.com");
    await insertDrink("d1", "Irn-Bru", "Irn-Bru");

    await SELF.fetch(`${BASE}/users/me/collection`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie: carl.cookie },
      body: JSON.stringify({ drinkId: "d1" }),
    });

    const allysCollection = await SELF.fetch(`${BASE}/users/me/collection`, {
      headers: { cookie: ally.cookie },
    });
    expect((await allysCollection.json<CollectionListResponse>()).total).toBe(0);

    // And Ally must not be able to delete Carl's entry.
    const attempt = await SELF.fetch(`${BASE}/users/me/collection/d1`, {
      method: "DELETE",
      headers: { cookie: ally.cookie },
    });
    expect(attempt.status).toBe(404);

    const carlsCollection = await SELF.fetch(`${BASE}/users/me/collection`, {
      headers: { cookie: carl.cookie },
    });
    expect((await carlsCollection.json<CollectionListResponse>()).total).toBe(1);
  });

  it("updates notes and favourite status", async () => {
    const { cookie } = await register();
    await insertDrink("d1", "Fanta", "Fanta");
    await SELF.fetch(`${BASE}/users/me/collection`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ drinkId: "d1" }),
    });

    const patch = await SELF.fetch(`${BASE}/users/me/collection/d1`, {
      method: "PATCH",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ notes: "Better cold.", isFavourite: true }),
    });
    expect(patch.status).toBe(200);

    const list = await SELF.fetch(`${BASE}/users/me/collection`, {
      headers: { cookie },
    });
    const item = (await list.json<CollectionListResponse>()).items[0]!;
    expect(item.notes).toBe("Better cold.");
    expect(item.isFavourite).toBe(true);
  });

  it("reports collection stats", async () => {
    const { cookie } = await register();
    await insertDrink("d1", "Coke", "Coca-Cola");
    await insertDrink("d2", "Coke Zero", "Coca-Cola");
    await env.DB.prepare(
      `INSERT INTO drinks (id, name, brand, brand_normalised, category, country)
       VALUES ('d3', 'Ting', 'Ting', 'ting', 'citrus', 'JM')`,
    ).run();

    for (const drinkId of ["d1", "d2", "d3"]) {
      await SELF.fetch(`${BASE}/users/me/collection`, {
        method: "POST",
        headers: { ...JSON_HEADERS, cookie },
        body: JSON.stringify({ drinkId }),
      });
    }

    const response = await SELF.fetch(`${BASE}/users/me/collection`, {
      headers: { cookie },
    });
    const { stats } = await response.json<CollectionListResponse>();

    expect(stats.drinkCount).toBe(3);
    expect(stats.brandCount).toBe(2); // Coca-Cola and Ting
    expect(stats.countryCount).toBe(2); // GB and JM
  });

  it("marks collected drinks on the catalogue for the signed-in viewer only", async () => {
    const { cookie } = await register();
    await insertDrink("d1", "Pepsi Max", "Pepsi");
    await SELF.fetch(`${BASE}/users/me/collection`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ drinkId: "d1" }),
    });

    const signedIn = await SELF.fetch(`${BASE}/drinks/d1`, { headers: { cookie } });
    expect((await signedIn.json<DrinkDetailResponse>()).inViewerCollection).toBe(true);

    const signedOut = await SELF.fetch(`${BASE}/drinks/d1`);
    expect((await signedOut.json<DrinkDetailResponse>()).inViewerCollection).toBe(false);
  });
});
