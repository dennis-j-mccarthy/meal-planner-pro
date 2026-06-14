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

function normalizeCategory(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD") // decompose accents so "é" -> "e" + mark
    .replace(/[^a-z]/g, ""); // drop marks, spaces, punctuation
}

/**
 * Loose match between a proposal recipe's course label and a dish-plan
 * category, tolerating plurals and qualifiers (e.g. "Entrées" vs "Entrees",
 * "Sides" vs "Side", "Juices" vs "Healthy Juice").
 */
export function categoriesMatch(a: string, b: string): boolean {
  const na = normalizeCategory(a);
  const nb = normalizeCategory(b);
  if (!na || !nb) return false;
  const sa = na.replace(/s$/, "");
  const sb = nb.replace(/s$/, "");
  return (
    sa === sb ||
    na.includes(nb) ||
    nb.includes(na) ||
    sa.includes(sb) ||
    sb.includes(sa)
  );
}
