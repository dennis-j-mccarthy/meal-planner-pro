// Shared menu parser used by the paste-menu route and the inbound-email Bon
// Appetit webhook. Robust to real-world email whitespace (some clients blank-
// line every line): it classifies each non-empty line rather than relying on
// blank-line grouping.
//
// Classification, in order:
//   - a known category name       -> sets the current course
//   - a "Chef's Note" / "Note:"   -> captured as a plain-text note (not a dish)
//   - ends in . ! or ?            -> description of the current dish (supports
//                                    multi-line descriptions)
//   - anything else               -> the title of a new dish
// Titles are kept verbatim (never split on "&").

export type Dish = { title: string; description: string; category: string | null };
export type ParsedMenu = { dishes: Dish[]; notes: string[] };

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

// Matches "Chef's Note", "Chef’s Note" (curly apostrophe), or a bare "Note".
const NOTE_RE = /^(chef['’]?s\s+)?note\b/i;

export function matchCategory(line: string): string | null {
  const norm = line.trim().replace(/[:.]+$/, "").toLowerCase();
  return KNOWN_CATEGORIES.find((c) => c.toLowerCase() === norm) ?? null;
}

export function parseStructured(text: string): ParsedMenu {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dishes: Dish[] = [];
  const notes: string[] = [];
  let currentCategory: string | null = null;
  let current: Dish | null = null;

  for (const line of lines) {
    // Category header.
    const cat = matchCategory(line);
    if (cat) {
      currentCategory = cat;
      current = null;
      continue;
    }

    // Note — checked before the punctuation rule since notes end in a period.
    if (NOTE_RE.test(line)) {
      notes.push(line);
      current = null;
      continue;
    }

    // A sentence (ends in . ! ?) is the current dish's description; append so
    // multi-line descriptions are preserved.
    if (current && /[.!?]["'’)\]]?$/.test(line)) {
      current.description = current.description
        ? `${current.description} ${line}`
        : line;
      continue;
    }

    // Otherwise it's a new dish title.
    current = { title: line, description: "", category: currentCategory };
    dishes.push(current);
  }

  return { dishes, notes };
}
