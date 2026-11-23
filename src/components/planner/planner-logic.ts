// Pure helpers shared by the meal-plan builder's server code and its client
// components: course inference, client-safety matching, slot bucketing.
// No directive on purpose — importable from both sides, and never an action.
import { categoriesMatch, DEFAULT_DISH_CATEGORIES, type DishQuotaRow } from "@/lib/dish-quota";

/** A dish on the menu, as the planner UI sees it. Dates arrive pre-formatted. */
export type PlannerDish = {
  id: string; // ProposalRecipe id
  recipeId: string;
  title: string;
  description: string | null;
  tags: string | null;
  courseLabel: string | null;
  position: number;
  keptLastTime: boolean;
  /** "Oct 12" when this client had it in the 6 weeks before this cook date. */
  servedLabel: string | null;
  clientRemoved: boolean;
  /** An excluded word this dish contains (it got here via paste, Add anyway, or before the exclusion). */
  conflict: string | null;
};

/** A finder / swap / fill candidate. */
export type RecipeHit = {
  id: string;
  title: string;
  description: string | null;
  starred: boolean;
  /** Quota category inferred from the recipe's tags, or null. */
  category: string | null;
  /** "Oct 12": the last time this client had it (before this cook date). */
  lastServedLabel: string | null;
  /** Served within the 4 weeks before this cook date. */
  recentlyServed: boolean;
  /** The excluded word this recipe contains, e.g. "mushrooms". */
  conflict: string | null;
  timesKept: number;
};

export type PlannerFilters = {
  safeOnly: boolean;
  notRecent: boolean;
  category: string | null;
};

export const OTHER_SLOT = "Other";
export const MAX_CATEGORY_LENGTH = 60;
export const RECENT_DAYS = 28; // "Not served in 4 weeks"
export const SERVED_BADGE_DAYS = 42; // "Served <date>" badge window

/** Statuses whose menu can still be changed. One predicate for UI and actions. */
export function isEditableStatus(status: string): boolean {
  return status === "DRAFT" || status === "REVISIONS_REQUESTED";
}

// ---------------------------------------------------------------- courses

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const COURSE_RULES: Array<{ canonical: string; words: string[] }> = [
  { canonical: "Juices", words: ["juice", "juices", "smoothie", "smoothies", "drink", "drinks", "tonic", "tonics", "beverage", "beverages", "elixir"] },
  { canonical: "Breakfast", words: ["breakfast", "breakfasts", "morning", "brunch"] },
  { canonical: "Desserts", words: ["dessert", "desserts"] },
  { canonical: "Sides", words: ["side", "sides", "salad", "salads", "soup", "soups", "slaw", "slaws"] },
  { canonical: "Entrées", words: ["entree", "entrees", "dinner", "dinners", "main", "mains", "lunch", "lunches"] },
];

/** "Morning Nourishment" -> "Breakfast", "Salad" -> "Sides", else null. */
export function canonicalCourse(text: string | null | undefined): string | null {
  if (!text) return null;
  const words = normalize(text).split(/[^a-z]+/).filter(Boolean);
  for (const rule of COURSE_RULES) {
    if (words.some((w) => rule.words.includes(w))) return rule.canonical;
  }
  return null;
}

function singular(value: string): string {
  return normalize(value).replace(/[^a-z]/g, "").replace(/s$/, "");
}

/** Find the slot (from `slots`) a free-text course name belongs to. */
function slotForText(text: string, slots: string[], loose: boolean): string | null {
  const s = singular(text);
  if (!s) return null;
  const exact = slots.find((slot) => singular(slot) === s);
  if (exact) return exact;
  if (loose) {
    const fuzzy = slots.find((slot) => categoriesMatch(text, slot));
    if (fuzzy) return fuzzy;
  }
  const canonical = canonicalCourse(text);
  if (canonical) {
    const viaCanonical = slots.find((slot) => categoriesMatch(slot, canonical));
    if (viaCanonical) return viaCanonical;
  }
  return null;
}

function splitTags(tags: string | null | undefined): string[] {
  return (tags ?? "")
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Which slot a dish belongs in: its course label first (legacy labels like
 * "Salad" or "Healthy Juice" included), then its tags in order. Null when
 * nothing points anywhere.
 */
export function resolveSlot(
  courseLabel: string | null | undefined,
  tags: string | null | undefined,
  slots: string[],
): string | null {
  if (courseLabel) {
    const fromLabel = slotForText(courseLabel, slots, true);
    if (fromLabel) return fromLabel;
  }
  for (const tag of splitTags(tags)) {
    const fromTag = slotForText(tag, slots, false);
    if (fromTag) return fromTag;
  }
  return null;
}

/** Slot names for a client: their quota categories, or the default groups. */
export function slotNames(quota: DishQuotaRow[]): string[] {
  return quota.length > 0 ? quota.map((q) => q.category) : DEFAULT_DISH_CATEGORIES;
}

export type SlotGroup = {
  name: string;
  target: number | null; // null when the client has no dish plan
  dishes: PlannerDish[];
};

/** Bucket menu dishes into the client's slots (quota order), then "Other". */
export function groupDishes(dishes: PlannerDish[], quota: DishQuotaRow[]): SlotGroup[] {
  const names = slotNames(quota);
  const groups: SlotGroup[] = names.map((name) => ({
    name,
    target: quota.length > 0 ? (quota.find((q) => q.category === name)?.count ?? 0) : null,
    dishes: [],
  }));
  const other: SlotGroup = { name: OTHER_SLOT, target: null, dishes: [] };
  const sorted = [...dishes].sort((a, b) => a.position - b.position);
  for (const dish of sorted) {
    const slot = resolveSlot(dish.courseLabel, dish.tags, names);
    const group = slot ? groups.find((g) => g.name === slot) : undefined;
    (group ?? other).dishes.push(dish);
  }
  const visible =
    quota.length > 0 ? groups.filter((g) => (g.target ?? 0) > 0 || g.dishes.length > 0) : groups.filter((g) => g.dishes.length > 0);
  return other.dishes.length > 0 ? [...visible, other] : visible;
}

/** Dishes still missing per quota category (clientRemoved dishes don't count). */
export function openSlots(dishes: PlannerDish[], quota: DishQuotaRow[]): Map<string, number> {
  const open = new Map<string, number>();
  if (quota.length === 0) return open;
  const groups = groupDishes(
    dishes.filter((d) => !d.clientRemoved),
    quota,
  );
  for (const row of quota) {
    const have = groups.find((g) => g.name === row.category)?.dishes.length ?? 0;
    if (row.count - have > 0) open.set(row.category, row.count - have);
  }
  return open;
}

/** "Entrées" -> "entrée", "Sides" -> "side", "Breakfast" -> "breakfast". */
export function singularLabel(category: string): string {
  const lower = category.toLowerCase();
  if (lower.endsWith("ies")) return lower.slice(0, -3) + "y";
  if (lower.endsWith("ches") || lower.endsWith("shes")) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

export function withArticle(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

// ---------------------------------------------------------------- safety

const SYNONYMS: Record<string, string[]> = {
  nut: ["nut", "walnut", "almond", "pecan", "cashew", "pistachio", "hazelnut", "macadamia", "peanut", "pine nut"],
  "tree nut": ["walnut", "almond", "pecan", "cashew", "pistachio", "hazelnut", "macadamia", "pine nut"],
  peanut: ["peanut"],
  shellfish: ["shellfish", "shrimp", "prawn", "crab", "lobster", "scallop", "clam", "mussel", "oyster", "crawfish"],
  seafood: ["seafood", "shrimp", "prawn", "crab", "lobster", "scallop", "clam", "mussel", "oyster", "fish", "salmon", "tuna", "cod", "halibut"],
  fish: ["fish", "salmon", "tuna", "cod", "halibut", "tilapia", "trout", "snapper", "mahi", "sardine", "anchovy", "anchovies"],
  dairy: ["dairy", "milk", "cheese", "cream", "butter", "yogurt", "yoghurt", "parmesan", "feta", "ricotta", "mozzarella", "cheddar", "ghee"],
  gluten: ["gluten", "wheat", "flour", "bread", "pasta", "barley", "rye", "couscous", "panko", "breadcrumb"],
  egg: ["egg"],
  soy: ["soy", "tofu", "tempeh", "edamame", "miso"],
  pork: ["pork", "bacon", "ham", "prosciutto", "pancetta", "chorizo"],
  mushroom: ["mushroom", "shiitake", "portobello", "portabella", "cremini", "chanterelle", "porcini"],
  "red meat": ["beef", "steak", "lamb", "pork", "veal", "bison", "brisket"],
  beef: ["beef", "steak", "brisket"],
  spicy: ["spicy", "jalapeno", "habanero", "cayenne", "sriracha", "chipotle"],
};

const LEADING_NOISE =
  /^(?:no more|no|not|avoid(?:s|ing)?|allergic to|allergy to|allerg(?:y|ies)\s*:|intolerant to|does not eat|doesn't eat|don't eat|dislikes?|hates?|without|exclude|excluding)\s+/;
const TRAILING_NOISE = /\s+(?:allerg(?:y|ies)|intolerance|please|foods?|of any kind|at all)$/;

/** Split a free-text list ("No mushrooms, nuts & shellfish") into keywords. */
export function parseKeywords(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const raw of text.split(/[,;.\n/&]|\band\b|\bor\b|\+/i)) {
    let piece = normalize(raw)
      .replace(/\(.*?\)/g, " ")
      .replace(/[.!*"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    for (let i = 0; i < 3; i++) {
      piece = piece.replace(LEADING_NOISE, "").replace(TRAILING_NOISE, "").trim();
    }
    if (piece.length < 3) continue;
    if (piece.split(" ").length > 3) continue; // a sentence, not an ingredient
    if (!out.includes(piece)) out.push(piece);
  }
  return out;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stemOf(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("oes") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("ches") || word.endsWith("shes")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

export type ExclusionTerm = { keyword: string; base: string; pattern: RegExp };

/** Compile a client's exclusions into word-boundary matchers. */
export function compileExclusions(exclusions: string | null | undefined): ExclusionTerm[] {
  return parseKeywords(exclusions).map((keyword) => {
    const base = keyword.split(" ").map(stemOf).join(" ");
    const variants = new Set<string>([base, ...(SYNONYMS[base] ?? [])]);
    const alternation = [...variants]
      .map((v) => v.split(" ").map(escapeRegex).join("\\s+"))
      .sort((a, b) => b.length - a.length)
      .join("|");
    return {
      keyword,
      base,
      pattern: new RegExp(`\\b(?:${alternation})(?:s|es)?\\b`, "i"),
    };
  });
}

type SafetyFields = {
  title: string;
  description?: string | null;
  tags?: string | null;
  dietaryFlags?: string | null;
};

/**
 * The word in this recipe that conflicts with the client's exclusions, or
 * null when it looks safe. "nut-free" / "dairy free" count as safe for that
 * exclusion rather than as a hit.
 */
export function findConflict(recipe: SafetyFields, terms: ExclusionTerm[]): string | null {
  if (terms.length === 0) return null;
  const haystack = normalize(
    [recipe.title, recipe.description, recipe.tags, recipe.dietaryFlags].filter(Boolean).join(" \n "),
  );
  for (const term of terms) {
    const freeMarker = new RegExp(`\\b${escapeRegex(term.base)}s?[-\\s]free\\b`, "i");
    if (freeMarker.test(haystack)) continue;
    const cleaned = haystack.replace(/\b[a-z]+[-\s]free\b/g, " ");
    const match = cleaned.match(term.pattern);
    if (match) return match[0].toLowerCase();
  }
  return null;
}

/** True when any of the client's inclusion keywords appears in the recipe. */
export function matchesInclusions(recipe: SafetyFields, inclusions: string[]): boolean {
  if (inclusions.length === 0) return false;
  const haystack = normalize([recipe.title, recipe.description, recipe.tags].filter(Boolean).join(" "));
  return inclusions.some((kw) => {
    const stem = kw.split(" ").map(stemOf).map(escapeRegex).join("\\s+");
    return new RegExp(`\\b${stem}(?:s|es)?\\b`, "i").test(haystack);
  });
}

/** Human chips for the amber safety strip: "No mushrooms", "Mild spice for the kids". */
export function safetyChips(exclusions: string | null | undefined, dietaryNotes: string | null | undefined): string[] {
  const chips: string[] = [];
  for (const raw of (exclusions ?? "").split(/[,;\n]/)) {
    const piece = raw.trim().replace(/\.$/, "");
    if (!piece) continue;
    if (/^(no|avoid|not|allerg|without|does|doesn|don)/i.test(piece) || piece.split(/\s+/).length > 3) {
      chips.push(piece.charAt(0).toUpperCase() + piece.slice(1));
    } else {
      chips.push(`No ${piece.toLowerCase()}`);
    }
  }
  for (const raw of (dietaryNotes ?? "").split(/[;\n]/)) {
    const piece = raw.trim().replace(/\.$/, "");
    if (piece) chips.push(piece.charAt(0).toUpperCase() + piece.slice(1));
  }
  return chips;
}
