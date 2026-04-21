const TAG_RULES: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: "chicken", patterns: [/\bchicken\b/i] },
  { tag: "beef", patterns: [/\bbeef\b/i, /\bsteak\b/i] },
  { tag: "pork", patterns: [/\bpork\b/i, /\bham\b/i] },
  { tag: "turkey", patterns: [/\bturkey\b/i] },
  { tag: "shrimp", patterns: [/\bshrimp\b/i, /\bprawn/i] },
  { tag: "salmon", patterns: [/\bsalmon\b/i] },
  { tag: "fish", patterns: [/\bfish\b/i, /\bcod\b/i, /\bhalibut\b/i, /\btilapia\b/i] },
  { tag: "seafood", patterns: [/\bseafood\b/i, /\bscallop\b/i, /\bcrab\b/i] },
  { tag: "tofu", patterns: [/\btofu\b/i] },
  { tag: "vegan", patterns: [/\bvegan\b/i] },
  { tag: "vegetarian", patterns: [/\bvegetarian\b/i] },
  { tag: "salad", patterns: [/\bsalad\b/i, /\bslaw\b/i] },
  { tag: "soup", patterns: [/\bsoup\b/i, /\bbisque\b/i, /\bchowder\b/i] },
  { tag: "stew", patterns: [/\bstew\b/i, /\bbraise\b/i, /\bbraised\b/i] },
  { tag: "pasta", patterns: [/\bpasta\b/i, /\borzo\b/i, /\blasagna\b/i, /\bspaghetti\b/i] },
  { tag: "rice", patterns: [/\brice\b/i, /\bfried rice\b/i, /\brisotto\b/i] },
  { tag: "quinoa", patterns: [/\bquinoa\b/i] },
  { tag: "oats", patterns: [/\boats\b/i, /\boatmeal\b/i, /\bovernight oats\b/i] },
  { tag: "smoothie", patterns: [/\bsmoothie\b/i] },
  { tag: "juice", patterns: [/\bjuice\b/i, /\btonic\b/i] },
  { tag: "bowl", patterns: [/\bbowl\b/i, /\bbowls\b/i] },
  { tag: "taco", patterns: [/\btaco\b/i, /\btacos\b/i] },
  { tag: "curry", patterns: [/\bcurry\b/i] },
  { tag: "hummus", patterns: [/\bhummus\b/i] },
  { tag: "enchilada", patterns: [/\benchilada\b/i] },
  { tag: "meatballs", patterns: [/\bmeatball\b/i, /\bmeatballs\b/i] },
  { tag: "breakfast", patterns: [/\bbreakfast\b/i] },
  { tag: "dessert", patterns: [/\bdessert\b/i, /\bpudding\b/i, /\bcake\b/i] },
  { tag: "appetizer", patterns: [/\bappetizer\b/i, /\bappetizers\b/i] },
  { tag: "snack", patterns: [/\bsnack\b/i, /\bsnacks\b/i] },
];

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

export function deriveAttributeTagsFromTitle(title?: string | null) {
  if (!title) {
    return [];
  }

  const normalizedTitle = title.trim();

  return TAG_RULES.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(normalizedTitle)),
  ).map((rule) => rule.tag);
}

export function mergeTagValues(...tagSources: Array<string | string[] | null | undefined>) {
  const tags = tagSources.flatMap((source) => {
    if (!source) {
      return [];
    }

    if (Array.isArray(source)) {
      return source;
    }

    return source.split(",");
  });

  const unique = [...new Set(tags.map(normalizeTag).filter(Boolean))];
  return unique.length > 0 ? unique.join(", ") : null;
}
