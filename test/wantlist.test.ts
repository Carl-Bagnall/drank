import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  CollectionListResponse,
  DrinkDetailResponse,
  MeResponse,
} from "../src/shared/types";

/**
 * The rules this file exists to hold:
 *
 *   1. A rating means you have tried the drink, so rating one collects it.
 *   2. Removing a drink from the collection withdraws the rating with it.
 *   3. A drink is either collected or wanted, never both.
 *   4. The wantlist never counts towards collection totals.
 */

const BASE = "https://drank.test/api";
const JSON_HEADERS = { "Content-Type": "application/json" };

function sessionCookie(response: Response): string {
  return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
}

async function register(username = "carl", email = "carl@example.com") {
  const response = await SELF.fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, email, password: "correct horse battery" }),
  });
  return sessionCookie(response);
}

const add = (cookie: string, drinkId: string, status: string) =>
  SELF.fetch(`${BASE}/users/me/collection`, {
    method: "POST",
    headers: { ...JSON_HEADERS, cookie },
    body: JSON.stringify({ drinkId, status }),
  });

const rate = (cookie: string, drinkId: string, score: number) =>
  SELF.fetch(`${BASE}/drinks/${drinkId}/rating`, {
    method: "POST",
    headers: { ...JSON_HEADERS, cookie },
    body: JSON.stringify({ score }),
  });

const list = (cookie: string, status: string) =>
  SELF.fetch(`${BASE}/users/me/collection?status=${status}`, {
    headers: { cookie },
  }).then((r) => r.json<CollectionListResponse>());

const me = (cookie: string) =>
  SELF.fetch(`${BASE}/users/me`, { headers: { cookie } }).then((r) =>
    r.json<MeResponse>(),
  );

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM ratings"),
    env.DB.prepare("DELETE FROM collection_entries"),
    env.DB.prepare("DELETE FROM drinks"),
    env.DB.prepare("DELETE FROM users"),
  ]);

  // Ten drinks across two brands and two countries, so the stats tests can
  // tell a collected drink from a wanted one.
  const statements = [];
  for (let i = 0; i < 10; i++) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO drinks (id, name, brand, brand_normalised, category, country)
         VALUES (?, ?, ?, ?, 'cola', ?)`,
      ).bind(
        `d${i}`,
        `Drink ${i}`,
        i < 5 ? "Alpha" : "Beta",
        i < 5 ? "alpha" : "beta",
        i < 5 ? "GB" : "US",
      ),
    );
  }
  await env.DB.batch(statements);
});

describe("rating implies collecting", () => {
  it("collects a drink when it is rated", async () => {
    const cookie = await register();
    await rate(cookie, "d0", 8.2);

    const collection = await list(cookie, "collected");
    expect(collection.total).toBe(1);
    expect(collection.items[0]!.id).toBe("d0");
    expect(collection.items[0]!.viewerRating).toBe(8.2);
  });

  it("promotes a wanted drink to collected when it is rated", async () => {
    const cookie = await register();
    await add(cookie, "d0", "wanted");
    expect((await list(cookie, "wanted")).total).toBe(1);

    await rate(cookie, "d0", 7);

    expect((await list(cookie, "wanted")).total).toBe(0);
    expect((await list(cookie, "collected")).total).toBe(1);
  });

  it("never leaves a rating without a collection entry", async () => {
    const cookie = await register();
    await rate(cookie, "d0", 5);
    await rate(cookie, "d1", 9);

    const orphans = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM ratings r
       WHERE NOT EXISTS (
         SELECT 1 FROM collection_entries ce
         WHERE ce.user_id = r.user_id AND ce.drink_id = r.drink_id
           AND ce.status = 'collected'
       )`,
    ).first<{ count: number }>();

    expect(orphans?.count).toBe(0);
  });
});

describe("removing a drink withdraws its rating", () => {
  it("deletes the rating when the drink leaves the collection", async () => {
    const cookie = await register();
    await rate(cookie, "d0", 8);

    await SELF.fetch(`${BASE}/users/me/collection/d0`, {
      method: "DELETE",
      headers: { cookie },
    });

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM ratings",
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);

    const detail = await SELF.fetch(`${BASE}/drinks/d0`, { headers: { cookie } });
    const body = await detail.json<DrinkDetailResponse>();
    expect(body.viewerRating).toBeNull();
    expect(body.viewerEntry).toBeNull();
  });

  it("deletes the rating when the drink moves to the wantlist", async () => {
    const cookie = await register();
    await rate(cookie, "d0", 8);

    // Moving to "want to try" contradicts having tried it, so the score goes.
    await add(cookie, "d0", "wanted");

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM ratings",
    ).first<{ count: number }>();
    expect(row?.count).toBe(0);

    const wanted = await list(cookie, "wanted");
    expect(wanted.total).toBe(1);
    expect(wanted.items[0]!.viewerRating).toBeNull();
  });
});

describe("the two lists are mutually exclusive", () => {
  it("moves a drink rather than duplicating it", async () => {
    const cookie = await register();

    await add(cookie, "d0", "wanted");
    const moved = await add(cookie, "d0", "collected");
    expect(moved.status).toBe(200);
    expect(await moved.json()).toMatchObject({ outcome: "moved" });

    expect((await list(cookie, "wanted")).total).toBe(0);
    expect((await list(cookie, "collected")).total).toBe(1);

    const rows = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM collection_entries WHERE drink_id = 'd0'",
    ).first<{ count: number }>();
    expect(rows?.count).toBe(1);
  });

  it("reports an unchanged add rather than failing", async () => {
    const cookie = await register();
    await add(cookie, "d0", "wanted");
    const again = await add(cookie, "d0", "wanted");

    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ outcome: "unchanged" });
  });

  it("rejects an unknown status", async () => {
    const cookie = await register();
    const response = await add(cookie, "d0", "borrowed");
    expect(response.status).toBe(400);

    const listing = await SELF.fetch(
      `${BASE}/users/me/collection?status=borrowed`,
      { headers: { cookie } },
    );
    expect(listing.status).toBe(400);
  });
});

describe("the wantlist never counts towards the collection", () => {
  it("counts five collected and five wanted separately", async () => {
    const cookie = await register();

    // Five collected, all rated; five wanted.
    for (const i of [0, 1, 2, 3, 4]) await rate(cookie, `d${i}`, 8);
    for (const i of [5, 6, 7, 8, 9]) await add(cookie, `d${i}`, "wanted");

    const { stats } = await me(cookie);

    expect(stats.drinkCount).toBe(5);
    expect(stats.wantlistCount).toBe(5);
    // Collected drinks are all brand Alpha / country GB; the wanted ones are
    // Beta / US and must not show up in either total.
    expect(stats.brandCount).toBe(1);
    expect(stats.countryCount).toBe(1);
  });

  it("keeps the wantlist out of the collection listing and its stats", async () => {
    const cookie = await register();
    await add(cookie, "d0", "collected");
    await add(cookie, "d5", "wanted");

    const collection = await list(cookie, "collected");
    expect(collection.total).toBe(1);
    expect(collection.stats.drinkCount).toBe(1);
    expect(collection.stats.wantlistCount).toBe(1);
    expect(collection.items.map((d) => d.id)).toEqual(["d0"]);
  });

  it("excludes wanted drinks from the average rating", async () => {
    const cookie = await register();
    await rate(cookie, "d0", 6);
    await add(cookie, "d5", "wanted");

    const { stats } = await me(cookie);
    expect(stats.averageRating).toBe(6);
    expect(stats.drinkCount).toBe(1);
  });

  it("excludes wanted drinks from collection filter options", async () => {
    const cookie = await register();
    await add(cookie, "d0", "collected"); // Alpha / GB
    await add(cookie, "d5", "wanted"); // Beta / US

    const facets = await SELF.fetch(`${BASE}/users/me/collection/facets`, {
      headers: { cookie },
    }).then((r) => r.json<{ brands: { value: string }[] }>());

    expect(facets.brands.map((b) => b.value)).toEqual(["Alpha"]);
  });

  it("excludes wanted drinks from favourites", async () => {
    const cookie = await register();
    await add(cookie, "d5", "wanted");
    // Favouriting is only reachable for collected drinks, but guard the query.
    await env.DB.prepare(
      "UPDATE collection_entries SET is_favourite = 1 WHERE drink_id = 'd5'",
    ).run();

    const favourites = await SELF.fetch(`${BASE}/users/me/favourites`, {
      headers: { cookie },
    }).then((r) => r.json<{ items: unknown[] }>());

    expect(favourites.items).toHaveLength(0);
  });
});
