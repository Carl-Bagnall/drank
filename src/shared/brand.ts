/**
 * Brand normalisation.
 *
 * `drinks.brand_normalised` is what groups a variant family ("all Coca-Cola
 * drinks") and backs duplicate detection. The rule lives here so the seed,
 * the API and any future import path cannot disagree about it.
 */
export function normaliseBrand(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, " ");
}
