import {
  isValidBarcode,
  parseVolumeMl,
  type LookupResult,
  type ProductDataProvider,
} from "./productProvider";

/**
 * Open Food Facts.
 *
 * Read-only, over their public API. Nothing is scraped: this calls the
 * documented v2 product endpoint and asks only for the fields it uses.
 *
 * Open Food Facts asks every client to identify itself with a descriptive
 * User-Agent, and rate-limits anonymous traffic. The agent string is
 * configurable so a deployment can name itself accurately.
 */

const API_BASE = "https://world.openfoodfacts.org/api/v2/product";

/** Only the fields that map onto a drink, to keep responses small. */
const FIELDS = [
  "code",
  "product_name",
  "brands",
  "quantity",
  "countries_tags",
  "image_front_url",
  "image_url",
].join(",");

const DEFAULT_USER_AGENT =
  "Drank/0.1 (https://github.com/Carl-Bagnall/drank) - soft drink catalogue";

/** Give up rather than making the user wait on a slow third party. */
const TIMEOUT_MS = 5_000;

interface OpenFoodFactsResponse {
  status?: number | string;
  product?: {
    code?: string;
    product_name?: string;
    brands?: string;
    quantity?: string;
    countries_tags?: string[];
    image_front_url?: string;
    image_url?: string;
  };
}

/**
 * `countries_tags` looks like ["en:united-kingdom", "en:france"].
 *
 * Only a handful are worth mapping — anything unrecognised is left null and
 * the user picks it. Guessing wrongly is worse than leaving a field empty.
 */
const COUNTRY_TAGS: Record<string, string> = {
  "en:united-kingdom": "GB",
  "en:united-states": "US",
  "en:france": "FR",
  "en:germany": "DE",
  "en:italy": "IT",
  "en:spain": "ES",
  "en:ireland": "IE",
  "en:netherlands": "NL",
  "en:belgium": "BE",
  "en:austria": "AT",
  "en:switzerland": "CH",
  "en:poland": "PL",
  "en:japan": "JP",
  "en:mexico": "MX",
  "en:jamaica": "JM",
  "en:india": "IN",
  "en:australia": "AU",
  "en:canada": "CA",
  "en:new-zealand": "NZ",
  "en:peru": "PE",
};

function firstCountry(tags: string[] | undefined): string | null {
  if (!tags) return null;
  for (const tag of tags) {
    const code = COUNTRY_TAGS[tag.toLowerCase()];
    if (code) return code;
  }
  return null;
}

/** `brands` is a comma-separated list; the first is the primary one. */
function firstBrand(brands: string | undefined): string | null {
  if (!brands) return null;
  const first = brands.split(",")[0]?.trim();
  return first ? first : null;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function createOpenFoodFactsProvider(
  userAgent: string = DEFAULT_USER_AGENT,
): ProductDataProvider {
  return {
    name: "open_food_facts",

    async lookupByBarcode(barcode: string): Promise<LookupResult> {
      if (!isValidBarcode(barcode)) {
        return { status: "not_found" };
      }

      const url = `${API_BASE}/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { "User-Agent": userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (err) {
        return {
          status: "unavailable",
          reason: err instanceof Error ? err.message : "Network error",
        };
      }

      // 404 is how Open Food Facts reports an unknown barcode, which is not
      // an error — the brief is explicit that an unknown barcode is a normal
      // outcome, not a failure.
      if (response.status === 404) return { status: "not_found" };

      if (!response.ok) {
        return { status: "unavailable", reason: `HTTP ${response.status}` };
      }

      let body: OpenFoodFactsResponse;
      try {
        body = await response.json<OpenFoodFactsResponse>();
      } catch {
        return { status: "unavailable", reason: "Malformed response" };
      }

      // v2 answers with status 1 / "success"; older responses use 0 / "failure".
      const found =
        body.status === 1 || body.status === "success" || body.status === "1";
      if (!found || !body.product) return { status: "not_found" };

      const product = body.product;
      const name = clean(product.product_name);
      const brand = firstBrand(product.brands);

      // A record with neither a name nor a brand is not worth prefilling with;
      // it would just look like the lookup half-worked.
      if (!name && !brand) return { status: "not_found" };

      return {
        status: "found",
        suggestion: {
          barcode,
          name,
          brand,
          volumeMl: parseVolumeMl(product.quantity),
          country: firstCountry(product.countries_tags),
          imageUrl: clean(product.image_front_url) ?? clean(product.image_url),
          source: "open_food_facts",
          sourceId: clean(product.code) ?? barcode,
        },
      };
    },
  };
}
