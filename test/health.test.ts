import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM drinks").run();
  });

  it("reports ok and counts published drinks", async () => {
    await env.DB.prepare(
      "INSERT INTO drinks (id, name, brand, brand_normalised) VALUES (?, ?, ?, ?)",
    )
      .bind("health-drink", "Irn-Bru", "Irn-Bru", "irn-bru")
      .run();

    const response = await SELF.fetch("https://drank.test/api/health");
    expect(response.status).toBe(200);

    const body = await response.json<{
      status: string;
      database: string;
      publishedDrinks: number;
    }>();

    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
    expect(body.publishedDrinks).toBe(1);
  });

  it("excludes hidden drinks from the count", async () => {
    await env.DB.batch([
      env.DB
        .prepare("INSERT INTO drinks (id, name, brand, brand_normalised) VALUES (?, ?, ?, ?)")
        .bind("visible", "Pepsi Max", "Pepsi", "pepsi"),
      env.DB
        .prepare("INSERT INTO drinks (id, name, brand, brand_normalised, status) VALUES (?, ?, ?, ?, ?)")
        .bind("hidden", "Spam Drink", "Spam", "spam", "hidden"),
    ]);

    const response = await SELF.fetch("https://drank.test/api/health");
    const body = await response.json<{ publishedDrinks: number }>();

    expect(body.publishedDrinks).toBe(1);
  });
});

describe("unknown API routes", () => {
  it("returns a JSON 404 rather than the SPA shell", async () => {
    const response = await SELF.fetch("https://drank.test/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json<{ error: string }>();
    expect(body.error).toBe("not_found");
  });
});
