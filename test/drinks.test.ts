import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { DrinkDetailResponse, DrinkListResponse, Facets } from "../src/shared/types";

const BASE = "https://drank.test/api";

/** Inserts a drink with sensible defaults for the fields a test ignores. */
async function insertDrink(drink: {
  id: string;
  name: string;
  brand: string;
  flavour?: string | null;
  category?: string | null;
  country?: string | null;
  status?: string;
  createdAt?: string;
}) {
  await env.DB.prepare(
    `INSERT INTO drinks
       (id, name, brand, brand_normalised, flavour, category, country, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  )
    .bind(
      drink.id,
      drink.name,
      drink.brand,
      drink.brand.trim().toLowerCase(),
      drink.flavour ?? null,
      drink.category ?? null,
      drink.country ?? null,
      drink.status ?? "published",
      drink.createdAt ?? null,
    )
    .run();
}

async function rate(userId: string, drinkId: string, score: number) {
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, username, email, password_hash) VALUES (?, ?, ?, 'x')",
  )
    .bind(userId, userId, `${userId}@example.com`)
    .run();
  await env.DB.prepare(
    "INSERT INTO ratings (id, user_id, drink_id, score) VALUES (?, ?, ?, ?)",
  )
    .bind(`${userId}-${drinkId}`, userId, drinkId, score)
    .run();
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ratings"),
    env.DB.prepare("DELETE FROM collection_entries"),
    env.DB.prepare("DELETE FROM drinks"),
    env.DB.prepare("DELETE FROM users"),
  ]);
});

describe("GET /api/drinks", () => {
  it("returns published drinks with a total and no cursor when exhausted", async () => {
    await insertDrink({ id: "a", name: "Irn-Bru", brand: "Irn-Bru" });
    await insertDrink({ id: "b", name: "Pepsi Max", brand: "Pepsi" });

    const response = await SELF.fetch(`${BASE}/drinks`);
    expect(response.status).toBe(200);

    const body = await response.json<DrinkListResponse>();
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBeNull();
  });

  it("excludes drinks that are not published", async () => {
    await insertDrink({ id: "visible", name: "Sprite", brand: "Sprite" });
    await insertDrink({
      id: "hidden",
      name: "Spam",
      brand: "Spam",
      status: "hidden",
    });

    const body = await (await SELF.fetch(`${BASE}/drinks`)).json<DrinkListResponse>();
    expect(body.total).toBe(1);
    expect(body.items[0]!.id).toBe("visible");
  });

  it("averages the community rating on the 0-10 scale", async () => {
    await insertDrink({ id: "a", name: "Fanta", brand: "Fanta" });
    await rate("u1", "a", 80); // 8.0
    await rate("u2", "a", 95); // 9.5

    const body = await (await SELF.fetch(`${BASE}/drinks`)).json<DrinkListResponse>();
    expect(body.items[0]!.community).toEqual({ average: 8.8, count: 2 });
  });

  it("reports no community rating for an unrated drink", async () => {
    await insertDrink({ id: "a", name: "Vimto", brand: "Vimto" });

    const body = await (await SELF.fetch(`${BASE}/drinks`)).json<DrinkListResponse>();
    expect(body.items[0]!.community).toEqual({ average: null, count: 0 });
  });

  it("searches across name, brand, flavour, category and country", async () => {
    await insertDrink({
      id: "a",
      name: "Coca-Cola Cherry",
      brand: "Coca-Cola",
      flavour: "Cherry",
      category: "cola",
      country: "GB",
    });
    await insertDrink({ id: "b", name: "Ting", brand: "Ting", country: "JM" });

    for (const [term, expected] of [
      ["cherry", "a"], // flavour and name
      ["coca", "a"], // brand
      ["cola", "a"], // category
      ["jm", "b"], // country
      ["ting", "b"], // name
    ] as const) {
      const body = await (
        await SELF.fetch(`${BASE}/drinks?q=${term}`)
      ).json<DrinkListResponse>();
      expect(body.items.map((d) => d.id), `term: ${term}`).toEqual([expected]);
    }
  });

  it("filters by category and country", async () => {
    await insertDrink({ id: "a", name: "A", brand: "A", category: "cola", country: "GB" });
    await insertDrink({ id: "b", name: "B", brand: "B", category: "energy", country: "AT" });

    const byCategory = await (
      await SELF.fetch(`${BASE}/drinks?category=energy`)
    ).json<DrinkListResponse>();
    expect(byCategory.items.map((d) => d.id)).toEqual(["b"]);

    const byCountry = await (
      await SELF.fetch(`${BASE}/drinks?country=GB`)
    ).json<DrinkListResponse>();
    expect(byCountry.items.map((d) => d.id)).toEqual(["a"]);
  });

  it("sorts unrated drinks last when sorting by rating", async () => {
    await insertDrink({ id: "rated", name: "Rated", brand: "R" });
    await insertDrink({ id: "unrated", name: "Unrated", brand: "U" });
    await rate("u1", "rated", 60);

    const body = await (
      await SELF.fetch(`${BASE}/drinks?sort=rating`)
    ).json<DrinkListResponse>();
    expect(body.items.map((d) => d.id)).toEqual(["rated", "unrated"]);
  });

  it("paginates with an opaque cursor", async () => {
    for (let i = 0; i < 5; i++) {
      await insertDrink({ id: `d${i}`, name: `Drink ${i}`, brand: "B" });
    }

    const first = await (
      await SELF.fetch(`${BASE}/drinks?limit=2&sort=name`)
    ).json<DrinkListResponse>();
    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(5);
    expect(first.nextCursor).not.toBeNull();

    const second = await (
      await SELF.fetch(`${BASE}/drinks?limit=2&sort=name&cursor=${first.nextCursor}`)
    ).json<DrinkListResponse>();
    expect(second.items).toHaveLength(2);

    // Pages must not overlap.
    const firstIds = first.items.map((d) => d.id);
    expect(second.items.some((d) => firstIds.includes(d.id))).toBe(false);
  });

  it("rejects invalid sort, limit and cursor values", async () => {
    for (const query of ["sort=sideways", "limit=0", "limit=999", "limit=abc", "cursor=-1"]) {
      const response = await SELF.fetch(`${BASE}/drinks?${query}`);
      expect(response.status, `query: ${query}`).toBe(400);
      const body = await response.json<{ error: string }>();
      expect(body.error).toBe("bad_request");
    }
  });
});

describe("GET /api/drinks/:id", () => {
  it("returns the drink, its community rating and its brand siblings", async () => {
    await insertDrink({ id: "cherry", name: "Coke Cherry", brand: "Coca-Cola" });
    await insertDrink({ id: "vanilla", name: "Coke Vanilla", brand: "Coca-Cola" });
    await insertDrink({ id: "other", name: "Pepsi", brand: "Pepsi" });
    await rate("u1", "cherry", 75);

    const response = await SELF.fetch(`${BASE}/drinks/cherry`);
    expect(response.status).toBe(200);

    const body = await response.json<DrinkDetailResponse>();
    expect(body.drink.name).toBe("Coke Cherry");
    expect(body.community).toEqual({ average: 7.5, count: 1 });
    // Same brand only, and never the drink itself.
    expect(body.siblings.map((d) => d.id)).toEqual(["vanilla"]);
  });

  it("404s for an unknown id", async () => {
    const response = await SELF.fetch(`${BASE}/drinks/nope`);
    expect(response.status).toBe(404);
    expect((await response.json<{ error: string }>()).error).toBe("not_found");
  });

  it("404s for a drink that is not published", async () => {
    await insertDrink({ id: "hidden", name: "Spam", brand: "Spam", status: "hidden" });
    const response = await SELF.fetch(`${BASE}/drinks/hidden`);
    expect(response.status).toBe(404);
  });
});

describe("GET /api/drinks/facets", () => {
  it("counts categories and countries, ignoring unpublished drinks", async () => {
    await insertDrink({ id: "a", name: "A", brand: "A", category: "cola", country: "GB" });
    await insertDrink({ id: "b", name: "B", brand: "B", category: "cola", country: "US" });
    await insertDrink({
      id: "c",
      name: "C",
      brand: "C",
      category: "cola",
      country: "GB",
      status: "hidden",
    });

    const body = await (await SELF.fetch(`${BASE}/drinks/facets`)).json<Facets>();
    expect(body.categories).toEqual([{ value: "cola", count: 2 }]);
    expect(body.countries).toEqual([
      { value: "GB", count: 1 },
      { value: "US", count: 1 },
    ]);
  });

  it("is not shadowed by the :id route", async () => {
    const response = await SELF.fetch(`${BASE}/drinks/facets`);
    expect(response.status).toBe(200);
  });
});
