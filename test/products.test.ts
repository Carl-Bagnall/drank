import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BarcodeLookupResponse } from "../src/shared/types";
import {
  isValidBarcode,
  parseVolumeMl,
} from "../src/worker/services/productProvider";
import { createOpenFoodFactsProvider } from "../src/worker/services/openFoodFacts";

const BASE = "https://drank.test/api";
const JSON_HEADERS = { "Content-Type": "application/json" };

/**
 * The provider is tested directly with a stubbed `fetch`, rather than through
 * the route.
 *
 * This version of the workers pool does not expose `fetchMock`, and calling
 * the real Open Food Facts API from a suite would be slow, flaky and rude to
 * a volunteer-run service. Testing the provider in isolation also puts each
 * assertion next to the behaviour it describes: how the response is mapped
 * belongs to the provider, and what the API does with the result belongs to
 * the route.
 */
function stubFetch(status: number, body: unknown) {
  // Parameters are declared so the recorded call tuple is typed, which is how
  // the User-Agent assertion below reaches `init.headers`.
  const spy = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      typeof body === "string"
        ? new Response(body, { status })
        : new Response(JSON.stringify(body), {
            status,
            headers: { "Content-Type": "application/json" },
          }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

async function register(username = "carl", email = "carl@example.com") {
  const response = await SELF.fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, email, password: "correct horse battery" }),
  });
  return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
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

describe("volume parsing", () => {
  it("reads the units Open Food Facts actually uses", () => {
    expect(parseVolumeMl("330 ml")).toBe(330);
    expect(parseVolumeMl("33 cl")).toBe(330);
    expect(parseVolumeMl("1.5 l")).toBe(1500);
    expect(parseVolumeMl("1,5 l")).toBe(1500);
    expect(parseVolumeMl("500ml")).toBe(500);
  });

  it("returns null rather than guessing", () => {
    for (const input of [null, undefined, "", "family size", "6 pack", "0 ml"]) {
      expect(parseVolumeMl(input), String(input)).toBeNull();
    }
  });

  it("rejects an implausible volume", () => {
    // A free-text field will contain junk; better empty than absurd.
    expect(parseVolumeMl("99 l")).toBeNull();
  });
});

describe("barcode validation", () => {
  it("accepts 8 to 14 digits and nothing else", () => {
    expect(isValidBarcode("12345678")).toBe(true);
    expect(isValidBarcode("5000112611861")).toBe(true);
    expect(isValidBarcode("1234567")).toBe(false);
    expect(isValidBarcode("123456789012345")).toBe(false);
    expect(isValidBarcode("50001126a1861")).toBe(false);
    expect(isValidBarcode("")).toBe(false);
  });
});

describe("Open Food Facts provider", () => {
  it("maps a hit onto a suggestion", async () => {
    stubFetch(200, {
      status: 1,
      product: {
        code: "5449000000996",
        product_name: "Coca-Cola",
        brands: "Coca-Cola, The Coca-Cola Company",
        quantity: "330 ml",
        countries_tags: ["en:united-kingdom", "en:france"],
        image_front_url: "https://images.openfoodfacts.org/front.jpg",
      },
    });

    const result = await createOpenFoodFactsProvider().lookupByBarcode(
      "5449000000996",
    );

    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.suggestion).toMatchObject({
      barcode: "5449000000996",
      name: "Coca-Cola",
      // Only the first brand, not the whole comma-separated list.
      brand: "Coca-Cola",
      volumeMl: 330,
      // First recognised country tag wins; unrecognised ones are skipped.
      country: "GB",
      source: "open_food_facts",
    });
  });

  it("identifies itself, as Open Food Facts asks clients to", async () => {
    const spy = stubFetch(200, { status: 0 });
    await createOpenFoodFactsProvider("Drank-Test/1.0").lookupByBarcode(
      "12345678",
    );

    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = init?.headers as Record<string, string>;
    expect(headers["User-Agent"]).toBe("Drank-Test/1.0");
  });

  it("never calls out for a malformed barcode", async () => {
    const spy = stubFetch(200, { status: 1 });
    const result = await createOpenFoodFactsProvider().lookupByBarcode("abc");

    expect(result.status).toBe("not_found");
    expect(spy).not.toHaveBeenCalled();
  });

  it("reads both the old and new success markers", async () => {
    for (const status of [1, "success"]) {
      stubFetch(200, {
        status,
        product: { code: "12345678", product_name: "Something" },
      });
      const result = await createOpenFoodFactsProvider().lookupByBarcode(
        "12345678",
      );
      expect(result.status, String(status)).toBe("found");
      vi.unstubAllGlobals();
    }
  });

  it("treats an unknown product as not found, not a failure", async () => {
    stubFetch(200, { status: 0 });
    const result = await createOpenFoodFactsProvider().lookupByBarcode("12345678");
    expect(result.status).toBe("not_found");
  });

  it("treats a 404 as not found", async () => {
    stubFetch(404, {});
    const result = await createOpenFoodFactsProvider().lookupByBarcode("12345678");
    expect(result.status).toBe("not_found");
  });

  it("distinguishes an outage from a missing product", async () => {
    stubFetch(500, "upstream on fire");
    const result = await createOpenFoodFactsProvider().lookupByBarcode("12345678");

    // The distinction matters: an outage must not be cached as "no such drink".
    expect(result.status).toBe("unavailable");
  });

  it("survives a malformed response body", async () => {
    stubFetch(200, "not json at all");
    const result = await createOpenFoodFactsProvider().lookupByBarcode("12345678");
    expect(result.status).toBe("unavailable");
  });

  it("ignores a product with neither a name nor a brand", async () => {
    stubFetch(200, {
      status: 1,
      product: { code: "12345678", quantity: "330 ml" },
    });
    const result = await createOpenFoodFactsProvider().lookupByBarcode("12345678");

    // Prefilling a form with nothing but a volume looks like a half-broken
    // lookup; better to offer a blank form.
    expect(result.status).toBe("not_found");
  });
});

describe("GET /api/products/barcode/:barcode", () => {
  it("rejects a malformed barcode", async () => {
    const response = await SELF.fetch(`${BASE}/products/barcode/abc`);
    expect(response.status).toBe(400);
  });

  it("answers from the catalogue without calling the provider", async () => {
    await env.DB.prepare(
      `INSERT INTO drinks (id, name, brand, brand_normalised, barcode)
       VALUES ('d1', 'Irn-Bru', 'Irn-Bru', 'irn-bru', '5000382000018')`,
    ).run();

    const spy = stubFetch(200, { status: 1 });
    const response = await SELF.fetch(`${BASE}/products/barcode/5000382000018`);
    const body = await response.json<BarcodeLookupResponse>();

    expect(body.status).toBe("in_catalogue");
    if (body.status === "in_catalogue") expect(body.drink.id).toBe("d1");
    // The catalogue is the source of truth, so nothing goes out.
    expect(spy).not.toHaveBeenCalled();
  });

  it("ignores an unpublished drink when matching a barcode", async () => {
    await env.DB.prepare(
      `INSERT INTO drinks (id, name, brand, brand_normalised, barcode, status)
       VALUES ('hidden', 'Spam', 'Spam', 'spam', '5000382000019', 'hidden')`,
    ).run();

    const response = await SELF.fetch(`${BASE}/products/barcode/5000382000019`);
    const body = await response.json<BarcodeLookupResponse>();
    expect(body.status).not.toBe("in_catalogue");
  });
});

describe("POST /api/drinks", () => {
  it("requires an account", async () => {
    const response = await SELF.fetch(`${BASE}/drinks`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: "Spam", brand: "Spam" }),
    });
    expect(response.status).toBe(401);
  });

  it("creates a drink from just a name and a brand", async () => {
    const cookie = await register();
    const response = await SELF.fetch(`${BASE}/drinks`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ name: "Cherry Cream Soda", brand: "Local Fizz Co" }),
    });

    expect(response.status).toBe(201);
    const { id } = await response.json<{ id: string }>();

    const row = await env.DB.prepare(
      "SELECT name, brand_normalised, created_by_user_id FROM drinks WHERE id = ?",
    )
      .bind(id)
      .first<Record<string, string>>();

    expect(row?.["name"]).toBe("Cherry Cream Soda");
    expect(row?.["brand_normalised"]).toBe("local fizz co");
    // Contributions are attributed.
    expect(row?.["created_by_user_id"]).toBeTruthy();
  });

  it("rejects invalid optional fields", async () => {
    const cookie = await register();
    const cases: Record<string, unknown>[] = [
      { name: "A", brand: "B", country: "GBR" },
      { name: "A", brand: "B", volumeMl: -1 },
      { name: "A", brand: "B", volumeMl: 99_999 },
      { name: "A", brand: "B", packaging: "crate" },
      { name: "A", brand: "B", category: "beer" },
      { name: "A", brand: "B", barcode: "123" },
      { name: "", brand: "B" },
      { name: "A" },
    ];

    for (const payload of cases) {
      const response = await SELF.fetch(`${BASE}/drinks`, {
        method: "POST",
        headers: { ...JSON_HEADERS, cookie },
        body: JSON.stringify(payload),
      });
      expect(response.status, JSON.stringify(payload)).toBe(400);
    }
  });

  it("rejects an image URL that is not http or https", async () => {
    const cookie = await register();
    // Keeping these out of the database beats trusting every render site.
    for (const imageUrl of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "not a url",
    ]) {
      const response = await SELF.fetch(`${BASE}/drinks`, {
        method: "POST",
        headers: { ...JSON_HEADERS, cookie },
        body: JSON.stringify({ name: "A", brand: "B", imageUrl }),
      });
      expect(response.status, imageUrl).toBe(400);
    }
  });

  it("points at the existing drink when the barcode is taken", async () => {
    const cookie = await register();
    await env.DB.prepare(
      `INSERT INTO drinks (id, name, brand, brand_normalised, barcode)
       VALUES ('existing', 'Irn-Bru', 'Irn-Bru', 'irn-bru', '5000382000018')`,
    ).run();

    const response = await SELF.fetch(`${BASE}/drinks`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({
        name: "Irn Bru",
        brand: "Barrs",
        barcode: "5000382000018",
      }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "already_exists",
      drinkId: "existing",
    });
  });

  it("records where a suggestion came from", async () => {
    const cookie = await register();
    const response = await SELF.fetch(`${BASE}/drinks`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({
        name: "Ramune",
        brand: "Hatakosen",
        externalSource: "open_food_facts",
        externalSourceId: "4902179011014",
      }),
    });

    const { id } = await response.json<{ id: string }>();
    const row = await env.DB.prepare(
      "SELECT external_source, external_source_id FROM drinks WHERE id = ?",
    )
      .bind(id)
      .first<Record<string, string>>();

    expect(row?.["external_source"]).toBe("open_food_facts");
    expect(row?.["external_source_id"]).toBe("4902179011014");
  });

  it("makes a new drink immediately findable", async () => {
    const cookie = await register();
    await SELF.fetch(`${BASE}/drinks`, {
      method: "POST",
      headers: { ...JSON_HEADERS, cookie },
      body: JSON.stringify({ name: "Elderflower Pop", brand: "Hedgerow Sodas" }),
    });

    const search = await SELF.fetch(`${BASE}/drinks?q=elderflower`);
    const body = await search.json<{ total: number }>();
    expect(body.total).toBe(1);
  });
});
