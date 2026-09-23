// Shared, deterministic menu parser used by the paste-menu route and the
// inbound-email Bon Appetit webhook. Keeps each block's title verbatim (never
// splits on "&" or moves parts into the description) and preserves full
// descriptions. Category headers set the current course.

export type Dish = { title: string; description: string; category: string | null };

export const KNOWN_CATEGORIES = [
  "Healthy Juice",
  "Smoothie",
  "Breakfast",
  "Morning Nourishment",
  "Snack",
  "Salad",
  "Soup",
  "Entrees",
  "Side",
  "Dessert",
  "A Gift from Beth",
];

export function matchCategory(line: string): string | null {
  const norm = line.trim().replace(/[:.]+$/, "").toLowerCase();
  return KNOWN_CATEGORIES.find((c) => c.toLowerCase() === norm) ?? null;
}

// Blocks are separated by blank lines. A single-line block naming a course is a
// category header; every other block is ONE recipe — first line = title, the
// remaining lines = description.
export function parseStructured(text: string): Dish[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const dishes: Dish[] = [];
  let currentCategory: string | null = null;

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    if (lines.length === 1 && matchCategory(lines[0])) {
      currentCategory = matchCategory(lines[0]);
      continue;
    }

    let idx = 0;
    const leadCategory = matchCategory(lines[0]);
    if (leadCategory) {
      currentCategory = leadCategory;
      idx = 1;
    }
    if (idx >= lines.length) continue;

    dishes.push({
      title: lines[idx],
      description: lines.slice(idx + 1).join(" "),
      category: currentCategory,
    });
  }

  return dishes;
}
