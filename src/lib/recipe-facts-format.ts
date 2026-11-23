// Recipe facts: structured ingredients + per-serving nutrition, and the pure
// helpers the grocery list and the Bon Appetit nutrition footer are built on.
//
// PURE MODULE: no prisma, no network, no "server-only" imports, so it can be
// used from server code, client components and offline checks alike.
//
// ── Storage formats ─────────────────────────────────────────────────────────
//
// Recipe.ingredientsText holds ONE of:
//   1. Legacy plain text that Beth typed or imported: one ingredient per line.
//      Never rewritten by this module.
//   2. Structured (AI-estimated) ingredients, only ever written when the field
//      was empty. The FIRST LINE is exactly INGREDIENTS_JSON_MARKER ("##json")
//      and the rest is JSON:
//        {
//          "v": 1,
//          "estimated": true,
//          "servings": 4 | null,       // yield the quantities are written for
//          "items": [{ "name": "chicken thighs", "quantity": 2, "unit": "lb",
//                      "section": "Meat & Fish" }, ...]
//        }
//      Display code must go through ingredientsDisplayText(), never print the
//      raw field.
//
// Recipe.nutrition holds ONE of:
//   a. New: {"perServing":{"calories":520,"proteinG":32,"carbsG":41,"fatG":18,
//            "fiberG":6,"sodiumMg":540},"estimated":true,"v":1}
//   b. Older shape written by the recipe page's Nutrition button
//      (generateRecipeNutrition): {"calories":520,"protein":"32 g",
//      "carbs":"41 g","fat":"18 g","fiber":"6 g","sodium":"540 mg"}
//   parseNutrition() reads both and returns null for anything else.

export const INGREDIENTS_JSON_MARKER = "##json";

export const GROCERY_SECTIONS = [
  "Produce",
  "Meat & Fish",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Spices",
  "Frozen",
  "Other",
] as const;

export type GrocerySection = (typeof GROCERY_SECTIONS)[number];

export type Ingredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  section: GrocerySection;
};

export type ParsedIngredients = {
  source: "json" | "text" | "none";
  // True for AI-estimated (JSON) ingredients, false for Beth's own text.
  estimated: boolean;
  // Yield the quantities are written for (JSON form only; legacy text has no
  // yield of its own, callers use Recipe.servings for it).
  servings: number | null;
  items: Ingredient[];
};

export type NutritionFacts = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  estimated: boolean;
};

// One row of the Bon Appetit nutrition footer.
export type NutritionRow = {
  title: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
};

type RecipeLike = {
  ingredientsText?: string | null;
  nutrition?: string | null;
};

// ── Small coercion helpers ──────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Number from a number or a string like "32 g"; null when not finite. */
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const m = v.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function clampRound(v: unknown, max: number, decimals = 0): number | null {
  const n = toNumber(v);
  if (n === null || n < 0 || n > max) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function asSection(v: unknown): GrocerySection | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return GROCERY_SECTIONS.find((g) => g.toLowerCase() === s) ?? null;
}

// ── Units ───────────────────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, string> = {
  tsp: "tsp", tsps: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tbsps: "tbsp", tbs: "tbsp", tbl: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  c: "cup", cup: "cup", cups: "cup",
  oz: "oz", ounce: "oz", ounces: "oz",
  "fl oz": "fl oz", "fluid ounce": "fl oz", "fluid ounces": "fl oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  g: "g", gram: "g", grams: "g", gr: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  l: "l", liter: "l", liters: "l", litre: "l", litres: "l",
  pt: "pint", pint: "pint", pints: "pint",
  qt: "quart", quart: "quart", quarts: "quart",
  gal: "gallon", gallon: "gallon", gallons: "gallon",
  pinch: "pinch", pinches: "pinch",
  dash: "dash", dashes: "dash",
  clove: "clove", cloves: "clove",
  can: "can", cans: "can",
  jar: "jar", jars: "jar",
  package: "package", packages: "package", pkg: "package", packet: "package", packets: "package",
  bag: "bag", bags: "bag",
  box: "box", boxes: "box",
  bunch: "bunch", bunches: "bunch",
  head: "head", heads: "head",
  slice: "slice", slices: "slice",
  stalk: "stalk", stalks: "stalk",
  rib: "stalk", ribs: "stalk",
  sprig: "sprig", sprigs: "sprig",
  piece: "piece", pieces: "piece",
  stick: "stick", sticks: "stick",
  handful: "handful", handfuls: "handful",
  fillet: "fillet", fillets: "fillet", filet: "fillet", filets: "fillet",
  sheet: "sheet", sheets: "sheet",
};

const UNIT_PLURALS: Record<string, string> = {
  cup: "cups", pint: "pints", quart: "quarts", gallon: "gallons", pinch: "pinches",
  dash: "dashes", clove: "cloves", can: "cans", jar: "jars", package: "packages",
  bag: "bags", box: "boxes", bunch: "bunches", head: "heads", slice: "slices",
  stalk: "stalks", sprig: "sprigs", piece: "pieces", stick: "sticks",
  handful: "handfuls", fillet: "fillets", sheet: "sheets",
};

/** Canonical unit ("Tablespoons" → "tbsp"); unknown units are kept lowercased. */
export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  if (!u) return null;
  return UNIT_ALIASES[u] ?? u.slice(0, 20);
}

function unitLabel(unit: string, quantity: number | null): string {
  return quantity !== null && quantity > 1 ? UNIT_PLURALS[unit] ?? unit : unit;
}

// ── Quantities ──────────────────────────────────────────────────────────────

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};
const FRAC_CHARS = Object.keys(UNICODE_FRACTIONS).join("");
const NUM = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?\\s*[${FRAC_CHARS}]?|\\.\\d+|[${FRAC_CHARS}])`;
const QTY_RE = new RegExp(`^(${NUM})(?:\\s*(?:-|–|to)\\s*(${NUM}))?\\s*`);

function parseNumberToken(token: string): number | null {
  const t = token.trim();
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  m = t.match(/^(\d*(?:\.\d+)?)\s*([^\d\s.]?)$/);
  if (m) {
    const whole = m[1] ? Number(m[1]) : 0;
    const frac = m[2] ? UNICODE_FRACTIONS[m[2]] ?? 0 : 0;
    const n = whole + frac;
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

const NICE_FRACTIONS: [number, string][] = [
  [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"],
];

/** 1.5 → "1½", 0.333 → "⅓", 2.4 → "2.4", 12.6 → "13". */
export function formatQuantity(q: number): string {
  if (q >= 10) return String(Math.round(q));
  const whole = Math.floor(q);
  const rest = q - whole;
  if (rest < 0.04) return String(whole || q.toFixed(2).replace(/0+$/, ""));
  if (rest > 0.96) return String(whole + 1);
  for (const [v, glyph] of NICE_FRACTIONS) {
    if (Math.abs(rest - v) < 0.04) return whole ? `${whole}${glyph}` : glyph;
  }
  return String(Math.round(q * 10) / 10);
}

// ── Names, sections ─────────────────────────────────────────────────────────

const PREP_WORDS = new Set([
  "fresh", "freshly", "large", "medium", "small", "chopped", "minced", "diced",
  "sliced", "finely", "roughly", "coarsely", "thinly", "grated", "shredded",
  "organic", "ripe", "boneless", "skinless", "peeled", "trimmed", "packed",
  "cubed", "halved", "quartered", "crushed", "softened", "melted", "cold",
  "warm", "room-temperature", "about", "of",
]);

const NO_SINGULAR = new Set([
  "asparagus", "hummus", "molasses", "couscous", "citrus", "swiss", "grits",
  "brussels", "lemongrass", "harissa", "series", "species", "watercress", "bass",
]);

function singularize(word: string): string {
  if (word.length <= 3 || NO_SINGULAR.has(word)) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("leaves")) return word.slice(0, -6) + "leaf";
  if (word.endsWith("halves")) return word.slice(0, -6) + "half";
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Strip prep notes: "Garlic, minced (about 4)" → "Garlic". */
export function cleanIngredientName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, " ")
    .split(/,|;| - | – /)[0]
    .replace(/\s+(to taste|as needed|for serving|for garnish|optional)\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Merge key text: lowercase, prep words dropped, last word singular. */
export function normalizeName(name: string): string {
  const words = cleanIngredientName(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s&'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !PREP_WORDS.has(w));
  if (words.length === 0) return name.trim().toLowerCase();
  words[words.length - 1] = singularize(words[words.length - 1]);
  return words.join(" ");
}

/** Stable check-off key for an item: "chicken-thigh". */
export function itemKey(name: string): string {
  return (
    normalizeName(name)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "item"
  );
}

const SECTION_RULES: [GrocerySection, RegExp][] = [
  ["Frozen", /\bfrozen\b/],
  ["Spices", /\b(garlic powder|onion powder|chili powder|chile powder|curry powder|red pepper flakes|chili flakes|black pepper|white pepper|peppercorns?|ground (cumin|coriander|cinnamon|ginger|nutmeg|cloves?|turmeric|cardamom|allspice|mustard)|dried (oregano|basil|thyme|rosemary|parsley|dill|sage|herbs))\b/],
  ["Pantry", /\b(coconut milk|coconut cream|peanut butter|almond butter|cashew butter|cream of tartar|bread ?crumbs|panko|broth|stock|bouillon|tomato paste|canned|evaporated milk|condensed milk)\b/],
  ["Meat & Fish", /\b(chicken|beef|pork|turkey|lamb|veal|bacon|sausages?|salmon|shrimp|prawns?|cod|tuna|fish|steaks?|ham|prosciutto|pancetta|scallops?|crab|lobster|halibut|tilapia|duck|chorizo|anchov(y|ies)|mussels?|clams?|trout|mahi|snapper|sea bass|ground meat)\b/],
  ["Dairy & Eggs", /\b(milk|butter|cheese|cheddar|cream|yogh?urt|eggs?|parmesan|parmigiano|mozzarella|feta|ricotta|goat cheese|ghee|half-and-half|buttermilk|creme fraiche|crème fraîche|mascarpone|gruyere|gruyère|burrata)\b/],
  ["Produce", /\b(onions?|garlic|shallots?|tomato(es)?|potato(es)?|carrots?|celery|bell peppers?|red peppers?|green peppers?|jalape(n|ñ)os?|poblanos?|serranos?|lettuce|spinach|kale|arugula|chard|lemons?|limes?|oranges?|apples?|bananas?|berr(y|ies)|strawberr(y|ies)|blueberr(y|ies)|raspberr(y|ies)|avocados?|cucumbers?|zucchini|squash|mushrooms?|broccoli|broccolini|cauliflower|cabbage|ginger|basil|parsley|cilantro|mint|dill|thyme|rosemary|sage|chives|scallions?|green onions?|leeks?|corn|asparagus|beets?|radish(es)?|fennel|sweet potato(es)?|eggplants?|grapes?|mangos?|mangoes|pineapple|peach(es)?|pears?|cherr(y|ies)|herbs|sprouts|greens|bok choy|celeriac|turnips?|parsnips?|pomegranate|figs?|melon|watermelon|kiwi|edamame|green beans|snap peas|snow peas|lemongrass|microgreens)\b/],
  ["Bakery", /\b(bread|baguette|tortillas?|buns?|rolls?|pitas?|naan|croissants?|brioche|sourdough|ciabatta|english muffins?|bagels?|flatbreads?)\b/],
  ["Pantry", /\b(oil|vinegar|flour|sugar|rice|pasta|spaghetti|penne|noodles?|beans|lentils|chickpeas|quinoa|oats|honey|maple syrup|syrup|sauce|soy|tamari|mustard|mayo|mayonnaise|ketchup|nuts?|almonds?|walnuts?|pecans?|cashews?|pistachios?|pine nuts|seeds|tahini|baking powder|baking soda|chocolate|cocoa|cornstarch|yeast|wine|capers|olives|raisins|dates|coconut|vanilla|extract|salsa|pesto|crackers|cereal|granola|polenta|couscous|farro|barley|breadcrumbs|miso|sriracha|hot sauce|jam|preserves|tomato sauce|marinara)\b/],
  ["Spices", /\b(salt|pepper|cumin|paprika|oregano|cinnamon|nutmeg|turmeric|coriander|cayenne|bay leaf|bay leaves|cloves|cardamom|allspice|seasoning|za'atar|sumac|saffron|chili|chile|herbes de provence|italian seasoning|garam masala|five spice|fennel seed|mustard seed|sesame seed)\b/],
];

/** Best-effort supermarket section for an ingredient name. */
export function guessSection(name: string): GrocerySection {
  const n = name.toLowerCase();
  for (const [section, re] of SECTION_RULES) if (re.test(n)) return section;
  return "Other";
}

// ── Ingredients: parse / serialize / display ────────────────────────────────

function isJsonIngredients(text: string): boolean {
  return text.trimStart().split("\n", 1)[0].trim() === INGREDIENTS_JSON_MARKER;
}

/** Validate + clamp one structured ingredient (from Gemini or storage). */
export function sanitizeIngredient(raw: unknown): Ingredient | null {
  if (!isRecord(raw)) return null;
  const name = typeof raw.name === "string" ? raw.name.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (!name) return null;
  const q = toNumber(raw.quantity);
  const quantity = q !== null && q > 0 && q < 10000 ? Math.round(q * 1000) / 1000 : null;
  const unit = typeof raw.unit === "string" ? normalizeUnit(raw.unit) : null;
  const section = asSection(raw.section) ?? guessSection(name);
  return { name, quantity, unit, section };
}

export function sanitizeServings(v: unknown): number | null {
  const n = toNumber(v);
  return n !== null && n >= 1 && n <= 100 ? Math.round(n) : null;
}

/** The stored string for structured ingredients (see format note at top). */
export function serializeIngredientsJson(servings: number | null, items: Ingredient[]): string {
  return `${INGREDIENTS_JSON_MARKER}\n${JSON.stringify({ v: 1, estimated: true, servings, items })}`;
}

/** Best-effort parse of one plain-text ingredient line. Null for headers/blank. */
export function parseIngredientLine(rawLine: string): Ingredient | null {
  let line = rawLine
    .replace(/^\s*[-*•▢□◻︎·]+\s*/, "")
    .replace(/^\s*\d+\)\s+/, "")
    .replace(/^\s*\d+\.\s+(?=\d)/, "")
    .trim();
  if (!line || line.length > 200) return null;
  if (line.endsWith(":")) return null; // "For the sauce:"
  if (/^(ingredients|for the\b)/i.test(line) && line.split(" ").length <= 5 && !/\d/.test(line)) return null;

  let quantity: number | null = null;
  const qm = line.match(QTY_RE);
  if (qm) {
    const a = parseNumberToken(qm[1]);
    const b = qm[2] ? parseNumberToken(qm[2]) : null;
    // A range ("2-3 lemons") buys the upper end.
    quantity = b !== null && a !== null ? Math.max(a, b) : a;
    if (quantity !== null) line = line.slice(qm[0].length);
  }

  // "1 (15-oz) can chickpeas": drop the size note between qty and unit.
  line = line.replace(/^\([^)]*\)\s*/, "");

  let unit: string | null = null;
  const two = line.match(/^(fl\.?\s*oz|fluid ounces?)\b\.?\s*/i);
  if (two) {
    unit = "fl oz";
    line = line.slice(two[0].length);
  } else {
    const um = line.match(/^([A-Za-z]+)\.?(?=\s|$)\s*/);
    if (um) {
      const key = um[1].toLowerCase();
      // A bare "c" only counts as a unit right after a number.
      if (UNIT_ALIASES[key] && (quantity !== null || key.length > 1)) {
        unit = UNIT_ALIASES[key];
        line = line.slice(um[0].length);
      }
    }
  }

  line = line.replace(/^of\s+/i, "");
  const name = cleanIngredientName(line);
  if (!name) return null;
  return { name, quantity, unit, section: guessSection(name) };
}

/** Structured ingredients for a recipe, from either storage form. */
export function parseIngredients(recipe: RecipeLike | string | null | undefined): ParsedIngredients {
  const text = typeof recipe === "string" ? recipe : recipe?.ingredientsText;
  if (!text || !text.trim()) return { source: "none", estimated: false, servings: null, items: [] };

  if (isJsonIngredients(text)) {
    try {
      const body = JSON.parse(text.trimStart().slice(INGREDIENTS_JSON_MARKER.length));
      if (!isRecord(body) || !Array.isArray(body.items)) throw new Error("bad shape");
      const items = body.items.map(sanitizeIngredient).filter((i): i is Ingredient => i !== null);
      return {
        source: "json",
        estimated: body.estimated !== false,
        servings: sanitizeServings(body.servings),
        items,
      };
    } catch {
      return { source: "none", estimated: true, servings: null, items: [] };
    }
  }

  const items = text
    .split(/\r?\n/)
    .map(parseIngredientLine)
    .filter((i): i is Ingredient => i !== null);
  return { source: "text", estimated: false, servings: null, items };
}

export function formatIngredient(i: Pick<Ingredient, "name" | "quantity" | "unit">): string {
  const parts: string[] = [];
  if (i.quantity !== null) parts.push(formatQuantity(i.quantity));
  if (i.unit) parts.push(unitLabel(i.unit, i.quantity));
  parts.push(i.name);
  return parts.join(" ");
}

/**
 * What to SHOW for Recipe.ingredientsText. Beth's own text comes back as-is.
 * AI-estimated (JSON) ingredients come back as plain lines only when
 * includeEstimated is set; otherwise null, so client-facing output (coaching
 * Bon Appetits, edit boxes) never presents a guess as her recipe.
 */
export function ingredientsDisplayText(
  text: string | null | undefined,
  opts: { includeEstimated?: boolean } = {},
): string | null {
  if (!text || !text.trim()) return null;
  if (!isJsonIngredients(text)) return text;
  if (!opts.includeEstimated) return null;
  const parsed = parseIngredients(text);
  return parsed.items.length > 0 ? parsed.items.map(formatIngredient).join("\n") : null;
}

/** True when ingredientsText is the AI-estimated JSON form. */
export function hasEstimatedIngredients(text: string | null | undefined): boolean {
  return !!text && isJsonIngredients(text);
}

// ── Nutrition ───────────────────────────────────────────────────────────────

/** Validate + clamp a per-serving nutrition object (new key names). */
export function sanitizeNutrition(raw: unknown, estimated = true): NutritionFacts | null {
  if (!isRecord(raw)) return null;
  const facts: NutritionFacts = {
    calories: clampRound(raw.calories, 5000),
    proteinG: clampRound(raw.proteinG, 500),
    carbsG: clampRound(raw.carbsG, 1000),
    fatG: clampRound(raw.fatG, 500),
    fiberG: clampRound(raw.fiberG, 200),
    sodiumMg: clampRound(raw.sodiumMg, 20000),
    estimated,
  };
  return facts.calories === null ? null : facts;
}

export function serializeNutrition(perServing: NutritionFacts): string {
  const { calories, proteinG, carbsG, fatG, fiberG, sodiumMg } = perServing;
  return JSON.stringify({
    perServing: { calories, proteinG, carbsG, fatG, fiberG, sodiumMg },
    estimated: true,
    v: 1,
  });
}

// Old-shape sodium may be "0.5 g"; everything else is grams.
function oldSodiumMg(v: unknown): unknown {
  if (typeof v === "string" && /\d\s*g\b/i.test(v) && !/mg/i.test(v)) {
    const n = toNumber(v);
    return n === null ? null : n * 1000;
  }
  return v;
}

/** Per-serving nutrition from Recipe.nutrition (new or old shape), else null. */
export function parseNutrition(recipe: RecipeLike | string | null | undefined): NutritionFacts | null {
  const text = typeof recipe === "string" ? recipe : recipe?.nutrition;
  if (!text || !text.trim()) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  if (isRecord(raw.perServing)) {
    return sanitizeNutrition(raw.perServing, raw.estimated !== false);
  }
  if ("calories" in raw) {
    return sanitizeNutrition(
      {
        calories: raw.calories,
        proteinG: raw.protein,
        carbsG: raw.carbs,
        fatG: raw.fat,
        fiberG: raw.fiber,
        sodiumMg: oldSodiumMg(raw.sodium),
      },
      true,
    );
  }
  return null;
}

// ── Grocery merge / scale / group ───────────────────────────────────────────

/** Scale factor from a recipe's yield to the servings being cooked. 1 if unknown. */
export function scaleFactor(baseServings: number | null | undefined, targetServings: number | null | undefined): number {
  if (!baseServings || !targetServings || baseServings <= 0 || targetServings <= 0) return 1;
  return targetServings / baseServings;
}

export type GroceryEntry = {
  ingredient: Ingredient;
  factor: number;
  dish: string;
  client?: string | null;
  cookDateId?: string | null;
};

export type GroceryAmount = { quantity: number; unit: string | null };

export type GroceryItem = {
  key: string;
  name: string;
  section: GrocerySection;
  amounts: GroceryAmount[];
  // Some recipe lists it without a quantity ("salt to taste").
  asNeeded: boolean;
  dishes: string[];
  clients: string[];
  cookDateIds: string[];
};

export type GroceryGroup = { section: GrocerySection; items: GroceryItem[] };

/** Merge identical ingredients; quantities sum when the unit matches. */
export function mergeGroceryEntries(entries: GroceryEntry[]): GroceryItem[] {
  const byKey = new Map<string, GroceryItem>();
  for (const { ingredient, factor, dish, client, cookDateId } of entries) {
    const key = itemKey(ingredient.name);
    let item = byKey.get(key);
    if (!item) {
      item = {
        key,
        name: cleanIngredientName(ingredient.name) || ingredient.name,
        section: ingredient.section,
        amounts: [],
        asNeeded: false,
        dishes: [],
        clients: [],
        cookDateIds: [],
      };
      byKey.set(key, item);
    }
    if (item.section === "Other" && ingredient.section !== "Other") item.section = ingredient.section;
    if (ingredient.quantity === null) {
      item.asNeeded = true;
    } else {
      const unit = ingredient.unit ? normalizeUnit(ingredient.unit) : null;
      const q = ingredient.quantity * factor;
      const existing = item.amounts.find((a) => a.unit === unit);
      if (existing) existing.quantity += q;
      else item.amounts.push({ quantity: q, unit });
    }
    if (!item.dishes.includes(dish)) item.dishes.push(dish);
    if (client && !item.clients.includes(client)) item.clients.push(client);
    if (cookDateId && !item.cookDateIds.includes(cookDateId)) item.cookDateIds.push(cookDateId);
  }
  return [...byKey.values()];
}

/** Sections in store order, items A→Z within each; empty sections dropped. */
export function groupBySection(items: GroceryItem[]): GroceryGroup[] {
  return GROCERY_SECTIONS.map((section) => ({
    section,
    items: items
      .filter((i) => i.section === section)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}

/** "2 lb + 3 pieces", "1½ cups", "" when only "as needed". */
export function formatAmounts(item: Pick<GroceryItem, "amounts" | "asNeeded">): string {
  const parts = item.amounts.map((a) =>
    a.unit ? `${formatQuantity(a.quantity)} ${unitLabel(a.unit, a.quantity)}` : formatQuantity(a.quantity),
  );
  if (item.asNeeded && parts.length > 0) parts.push("as needed");
  return parts.join(" + ");
}

/** Plain-text list for the clipboard. */
export function groceryListText(title: string, groups: GroceryGroup[]): string {
  const lines: string[] = [title, ""];
  for (const g of groups) {
    lines.push(g.section.toUpperCase());
    for (const i of g.items) {
      const amt = formatAmounts(i);
      lines.push(`- ${amt ? `${amt} ` : ""}${i.name}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

/** Parse CookDate.groceryChecked; tolerant of null/garbage. */
export function parseCheckedKeys(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((k): k is string => typeof k === "string").slice(0, 2000) : [];
  } catch {
    return [];
  }
}

/** Footer rows for the dishes that have nutrition, in menu order. */
export function nutritionRows(recipes: { title: string; nutrition?: string | null }[]): NutritionRow[] {
  const rows: NutritionRow[] = [];
  for (const r of recipes) {
    const n = parseNutrition(r.nutrition);
    if (!n) continue;
    rows.push({
      title: r.title,
      calories: n.calories,
      proteinG: n.proteinG,
      carbsG: n.carbsG,
      fatG: n.fatG,
      fiberG: n.fiberG,
      sodiumMg: n.sodiumMg,
    });
  }
  return rows;
}
