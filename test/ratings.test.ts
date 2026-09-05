import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  DrinkDetailResponse,
  RatingBreakdownResponse,
  RatingResponse,
} from "../src/shared/types";

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

function rate(cookie: string, drinkId: string, score: unknown) {
  return SELF.fetch(`${BASE}/drinks/${drinkId}/rating`, {
    method: "POST",
    headers: { ...JSON_HEADERS, cookie },
    body: JSON.stringify({ score }),
  });
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM ratings"),
    env.DB.prepare("DELETE FROM collection_entries"),
    env.DB.prepare("DELETE FROM drinks"),
    env.DB.prepare("DELETE FROM users"),
  ]);
  await env.DB.prepare(
    `INSERT INTO drinks (id, name, brand, brand_normalised)
     VALUES ('d1', 'Irn-Bru', 'Irn-Bru', 'irn-bru')`,
  ).run();
});

describe("POST /api/drinks/:id/rating", () => {
  it("requires authentication", async () => {
    const response = await SELF.fetch(`${BASE}/drinks/d1/rating`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ score: 8 }),
    });
    expect(response.status).toBe(401);
  });

  it("records a score and returns the new community rating", async () => {
    const cookie = await register();
    const response = await rate(cookie, "d1", 8.5);

    expect(response.status).toBe(200);
    const body = await response.json<RatingResponse>();
    expect(body.viewerRating).toBe(8.5);
    expect(body.community).toEqual({ average: 8.5, count: 1 });
  });

  it("stores the score as integer tenths", async () => {
    const cookie = await register();
    await rate(cookie, "d1", 8.2);

    const row = await env.DB.prepare("SELECT score FROM ratings").first<{
      score: number;
    }>();
    expect(row?.score).toBe(82);
  });

  it("accepts a tenth-precision score and returns it unchanged", async () => {
    const cookie = await register();
    const response = await rate(cookie, "d1", 8.2);

    expect(response.status).toBe(200);
    const body = await response.json<RatingResponse>();
    expect(body.viewerRating).toBe(8.2);
    expect(body.community).toEqual({ average: 8.2, count: 1 });
  });

  it("accepts the whole range in tenth steps", async () => {
    const cookie = await register();
    for (const score of [0, 0.1, 5, 7.5, 8.2, 9.9, 10]) {
      const response = await rate(cookie, "d1", score);
      expect(response.status, `score ${score}`).toBe(200);
      expect((await response.json<RatingResponse>()).viewerRating).toBe(score);
    }
  });

  it("rejects out-of-range, off-step and non-numeric scores", async () => {
    const cookie = await register();
    for (const score of [-1, 10.1, 7.25, 8.15, "8", null, Number.NaN]) {
      const response = await rate(cookie, "d1", score);
      expect(response.status, JSON.stringify(score)).toBe(400);
    }
  });

  it("replaces an existing score rather than adding a second", async () => {
    const cookie = await register();
    await rate(cookie, "d1", 6);
    const second = await rate(cookie, "d1", 9);

    const body = await second.json<RatingResponse>();
    expect(body.viewerRating).toBe(9);
    expect(body.community).toEqual({ average: 9, count: 1 });

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM ratings WHERE drink_id = 'd1'",
    ).first<{ count: number }>();
    expect(row?.count).toBe(1);
  });

  it("404s for a drink that does not exist", async () => {
    const cookie = await register();
    const response = await rate(cookie, "nope", 8);
    expect(response.status).toBe(404);
  });

  it("averages across users and rounds to one decimal place", async () => {
    const a = await register("carl", "carl@example.com");
    const b = await register("ally", "ally@example.com");
    const c = await register("bo", "bo@example.com");

    await rate(a, "d1", 8);
    await rate(b, "d1", 9);
    const last = await rate(c, "d1", 9.5);

    // (8 + 9 + 9.5) / 3 = 8.8333… → 8.8
    const body = await last.json<RatingResponse>();
    expect(body.community).toEqual({ average: 8.8, count: 3 });
  });

  it("adds the drink to the collection, because rating means having tried it", async () => {
    const cookie = await register();
    await rate(cookie, "d1", 8);

    const detail = await SELF.fetch(`${BASE}/drinks/d1`, { headers: { cookie } });
    const body = await detail.json<DrinkDetailResponse>();

    expect(body.viewerRating).toBe(8);
    expect(body.inViewerCollection).toBe(true);
    expect(body.viewerEntry?.status).toBe("collected");
  });
});

describe("DELETE /api/drinks/:id/rating", () => {
  it("withdraws a score and updates the community rating", async () => {
    const a = await register("carl", "carl@example.com");
    const b = await register("ally", "ally@example.com");
    await rate(a, "d1", 4);
    await rate(b, "d1", 10);

    const response = await SELF.fetch(`${BASE}/drinks/d1/rating`, {
      method: "DELETE",
      headers: { cookie: a },
    });

    expect(response.status).toBe(200);
    const body = await response.json<RatingResponse>();
    expect(body.viewerRating).toBeNull();
    expect(body.community).toEqual({ average: 10, count: 1 });
  });

  it("404s when the user had not rated the drink", async () => {
    const cookie = await register();
    const response = await SELF.fetch(`${BASE}/drinks/d1/rating`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(response.status).toBe(404);
  });

  it("cannot delete another user's rating", async () => {
    const a = await register("carl", "carl@example.com");
    const b = await register("ally", "ally@example.com");
    await rate(a, "d1", 7);

    const attempt = await SELF.fetch(`${BASE}/drinks/d1/rating`, {
      method: "DELETE",
      headers: { cookie: b },
    });
    expect(attempt.status).toBe(404);

    const still = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM ratings",
    ).first<{ count: number }>();
    expect(still?.count).toBe(1);
  });
});

describe("GET /api/drinks/:id/ratings", () => {
  it("returns eleven bands, including empty ones", async () => {
    const response = await SELF.fetch(`${BASE}/drinks/d1/ratings`);
    const body = await response.json<RatingBreakdownResponse>();

    expect(body.distribution).toHaveLength(11);
    expect(body.distribution[0]).toEqual({ score: 0, count: 0 });
    expect(body.community).toEqual({ average: null, count: 0 });
  });

  it("groups tenths down into their whole-number band", async () => {
    const a = await register("carl", "carl@example.com");
    const b = await register("ally", "ally@example.com");
    await rate(a, "d1", 8); // band 8
    await rate(b, "d1", 8.9); // also band 8

    const response = await SELF.fetch(`${BASE}/drinks/d1/ratings`);
    const body = await response.json<RatingBreakdownResponse>();

    expect(body.distribution[8]).toEqual({ score: 8, count: 2 });
    expect(body.community.count).toBe(2);
  });

  it("is public", async () => {
    const response = await SELF.fetch(`${BASE}/drinks/d1/ratings`);
    expect(response.status).toBe(200);
  });
});

describe("rating effect on collection stats", () => {
  it("feeds the average rating shown on the profile", async () => {
    const cookie = await register();
    await env.DB.prepare(
      `INSERT INTO drinks (id, name, brand, brand_normalised)
       VALUES ('d2', 'Ting', 'Ting', 'ting')`,
    ).run();

    for (const drinkId of ["d1", "d2"]) {
      await SELF.fetch(`${BASE}/users/me/collection`, {
        method: "POST",
        headers: { ...JSON_HEADERS, cookie },
        body: JSON.stringify({ drinkId }),
      });
    }

    await rate(cookie, "d1", 7);
    await rate(cookie, "d2", 9);

    const me = await SELF.fetch(`${BASE}/users/me`, { headers: { cookie } });
    const body = await me.json<{ stats: { averageRating: number | null } }>();

    expect(body.stats.averageRating).toBe(8);
  });
});
