// Per-client dish plan: how many of each category go into a proposal. Stored
// on Client.dishQuota as a JSON array of { category, count } so categories are
// flexible (Entrées, Sides, Breakfast, Desserts, Juices, plus any custom ones).
export type DishQuotaRow = { category: string; count: number };

export const DEFAULT_DISH_CATEGORIES = [
  "Entrées",
  "Sides",
  "Breakfast",
  "Desserts",
  "Juices",
];

export function parseDishQuota(value: string | null | undefined): DishQuotaRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => ({
        category: String(r?.category ?? "").trim(),
        count: Math.max(0, Math.round(Number(r?.count) || 0)),
      }))
      .filter((r) => r.category.length > 0);
  } catch {
    return [];
  }
}

/** Sanitize and re-serialize a dish-quota array, or null if empty. */
export function serializeDishQuota(rows: DishQuotaRow[]): string | null {
  const clean = rows
    .map((r) => ({
      category: r.category.trim(),
      count: Math.max(0, Math.round(Number(r.count) || 0)),
    }))
    .filter((r) => r.category.length > 0);
  return clean.length > 0 ? JSON.stringify(clean) : null;
}

export function totalDishes(rows: DishQuotaRow[]): number {
  return rows.reduce((sum, r) => sum + r.count, 0);
}
