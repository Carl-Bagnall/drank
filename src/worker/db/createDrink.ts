import type { Drink } from "../../shared/types";
import { normaliseBrand } from "../../shared/brand";

/**
 * Creating a catalogue drink.
 *
 * Only name and brand are required. The brief is explicit that a
 * user-contributed drink may start as little more than that, and the schema
 * agrees — everything else is nullable.
 */

export interface NewDrink {
  name: string;
  brand: string;
  flavour: string | null;
  category: string | null;
  country: string | null;
  volumeMl: number | null;
  packaging: string | null;
  barcode: string | null;
  description: string | null;
  imageUrl: string | null;
  externalSource: string | null;
  externalSourceId: string | null;
  createdByUserId: string;
}

export type CreateDrinkResult =
  | { status: "created"; id: string }
  /** A drink already carries this barcode; the caller is sent to it. */
  | { status: "duplicate_barcode"; id: string };

export async function createDrink(
  db: D1Database,
  drink: NewDrink,
): Promise<CreateDrinkResult> {
  // Checked up front so the user gets sent to the existing drink rather than
  // a constraint error. The partial unique index on barcode is still the
  // actual guarantee, and the insert below is wrapped for the race.
  if (drink.barcode) {
    const existing = await db
      .prepare("SELECT id FROM drinks WHERE barcode = ?")
      .bind(drink.barcode)
      .first<{ id: string }>();
    if (existing) return { status: "duplicate_barcode", id: existing.id };
  }

  const id = crypto.randomUUID();

  try {
    await db
      .prepare(
        `INSERT INTO drinks
           (id, name, brand, brand_normalised, flavour, category, country,
            volume_ml, packaging, barcode, description, image_url,
            external_source, external_source_id, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        drink.name,
        drink.brand,
        normaliseBrand(drink.brand),
        drink.flavour,
        drink.category,
        drink.country,
        drink.volumeMl,
        drink.packaging,
        drink.barcode,
        drink.description,
        drink.imageUrl,
        drink.externalSource,
        drink.externalSourceId,
        drink.createdByUserId,
      )
      .run();
  } catch (err) {
    // Someone inserted the same barcode between the check and the insert.
    if (drink.barcode) {
      const existing = await db
        .prepare("SELECT id FROM drinks WHERE barcode = ?")
        .bind(drink.barcode)
        .first<{ id: string }>();
      if (existing) return { status: "duplicate_barcode", id: existing.id };
    }
    throw err;
  }

  return { status: "created", id };
}

/**
 * Other drinks from the same brand, offered before creating a new one.
 *
 * The brief asks for protection against duplicate catalogue records where
 * possible. This does not block anything — variants are genuinely separate
 * drinks — it just shows what already exists so people can spot their own.
 */
export async function findPossibleDuplicates(
  db: D1Database,
  brand: string,
  limit = 5,
): Promise<Pick<Drink, "id" | "name" | "brand">[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, brand
       FROM drinks
       WHERE brand_normalised = ? AND status = 'published'
       ORDER BY name COLLATE NOCASE ASC
       LIMIT ?`,
    )
    .bind(normaliseBrand(brand), limit)
    .all<Pick<Drink, "id" | "name" | "brand">>();

  return results;
}
