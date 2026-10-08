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
export type ParsedMenu = { dishes: Dish[]; notes: string[]; subtitle: string | null };

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
  let subtitle: string | null = null;
  let currentCategory: string | null = null;
  let current: Dish | null = null;
  // The most recent header, and whether any dish has been placed under it.
  let lastHeader: string | null = null;
  let lastHeaderHasDish = false;

  const isSentence = (l: string) => /[.!?]["'\u2019)\]]?$/.test(l);

  const setHeader = (header: string) => {
    // A header with nothing under it at the very top of the menu, followed by
    // another header, is the menu's subtitle (e.g. "A Special Weekend Retreat").
    if (lastHeader && !lastHeaderHasDish && dishes.length === 0 && !subtitle) {
      // Drop a stray footnote digit stuck to the last word ("Together1").
      subtitle = lastHeader.replace(/(?<=[a-z])\d$/, "");
    }
    lastHeader = header;
    lastHeaderHasDish = false;
    currentCategory = header;
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // The greeting ("Bon Appetit Kristin & Hallie!") is already the PDF's title.
    if (/^bon\s*app[e\u00e9]tit\b/i.test(line)) continue;

    // Known category header.
    const cat = matchCategory(line);
    if (cat) {
      setHeader(cat);
      continue;
    }

    // Note — checked before the punctuation rule since notes end in a period.
    if (NOTE_RE.test(line)) {
      notes.push(line);
      current = null;
      continue;
    }

    if (isSentence(line)) {
      // A sentence is the current dish's description; append so multi-line
      // descriptions are preserved.
      if (current) {
        current.description = current.description
          ? `${current.description} ${line}`
          : line;
      } else {
        // A sentence with no dish above it — keep it, as plain text.
        notes.push(line);
      }
      continue;
    }

    // Any other heading Beth writes (e.g. "Saturday Lunch"): an unpunctuated
    // line followed directly by another dish title is a section header.
    const next = lines[i + 1];
    if (next && !isSentence(next) && !NOTE_RE.test(next) && !matchCategory(next)) {
      setHeader(line.replace(/:+$/, "").trim());
      continue;
    }

    // Otherwise it's a new dish title.
    current = { title: line, description: "", category: currentCategory };
    dishes.push(current);
    lastHeaderHasDish = true;
  }

  return { dishes, notes, subtitle };
}
