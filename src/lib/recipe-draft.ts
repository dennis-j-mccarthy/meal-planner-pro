const GENERIC_TITLES = new Set([
  "appetizers",
  "breakfast",
  "brunch",
  "dinner",
  "drinks",
  "entrees",
  "juices",
  "lunch",
  "menu",
  "nutrition information for",
  "smoothies",
  "snacks",
]);

const COOKING_VERBS = [
  "assemble",
  "bake",
  "blend",
  "braise",
  "broil",
  "combine",
  "cook",
  "drizzle",
  "fold",
  "grill",
  "marinate",
  "mix",
  "pan-sear",
  "poach",
  "pour",
  "roast",
  "saute",
  "simmer",
  "serve",
  "steam",
  "stir",
  "toss",
  "top",
  "whisk",
];

const INGREDIENT_KEYWORDS = [
  "almond",
  "apple",
  "arugula",
  "asparagus",
  "avocado",
  "bacon",
  "basil",
  "bean",
  "beef",
  "beet",
  "blackberry",
  "blueberry",
  "broccoli",
  "brussels sprouts",
  "butter",
  "butternut squash",
  "cabbage",
  "capers",
  "carrot",
  "cashew",
  "cauliflower",
  "celery",
  "cheese",
  "cherry",
  "chia",
  "chicken",
  "chickpea",
  "cilantro",
  "cinnamon",
  "cod",
  "coconut",
  "corn",
  "cranberry",
  "cracker",
  "cream",
  "cucumber",
  "curry",
  "date",
  "dijon",
  "egg",
  "fennel",
  "feta",
  "fish",
  "flank steak",
  "garlic",
  "gazpacho",
  "ginger",
  "granola",
  "greens",
  "guacamole",
  "hummus",
  "jalapeno",
  "jicama",
  "kale",
  "lemon",
  "lentil",
  "lettuce",
  "lime",
  "mango",
  "maple",
  "mushroom",
  "mustard",
  "nut butter",
  "oat",
  "olive",
  "onion",
  "orange",
  "orzo",
  "pancake",
  "parsley",
  "pasta",
  "pecan",
  "pecorino",
  "pepper",
  "pine nut",
  "pineapple",
  "pistachio",
  "pork",
  "potato",
  "protein powder",
  "pumpkin seed",
  "quinoa",
  "raisin",
  "raspberry",
  "rice",
  "ricotta",
  "salad",
  "salmon",
  "salsa",
  "scallion",
  "scallop",
  "shrimp",
  "smoothie",
  "soup",
  "spinach",
  "squash",
  "steak",
  "strawberry",
  "sweet potato",
  "taco",
  "tahini",
  "tomato",
  "tofu",
  "turkey",
  "vinaigrette",
  "walnut",
  "watermelon",
  "white fish",
  "wine",
  "yogurt",
  "zucchini",
];

type RecipeDraft = {
  summary: string;
  ingredientsText: string;
  instructionsText: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function cleanRecipeSourceText(value?: string | null) {
  if (!value) {
    return "";
  }

  return normalizeWhitespace(
    value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
      .replace(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/g, " ")
      .replace(/\b(?:www\.)?[a-z0-9.-]+\.(?:com|net|org)\b/gi, " ")
      .replace(/[•]/g, ". ")
      .replace(/\s+/g, " "),
  );
}

function splitSentences(text: string) {
  const expanded = text
    .replace(/\b(Served with|Serve with|Enjoy with|Enjoy|Drizzle with|Top with|Topped with|Weekly Salad|Breakfast Items|Snacks To Graze On During the Week|Entrees for Lunch and Dinner Enjoyment)\b/g, ". $1")
    .replace(/\s+/g, " ");

  return expanded
    .split(/(?<=[.!?])\s+/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
}

function buildSummary(title: string, text: string) {
  const sentences = splitSentences(text);
  const firstSentence = sentences.find((sentence) => sentence.length > 24) ?? text;
  const cleanTitle = title.toLowerCase().replace(/[^\w\s]/g, "").trim();

  if (GENERIC_TITLES.has(cleanTitle) || cleanTitle.length < 5) {
    return firstSentence.slice(0, 240);
  }

  if (firstSentence.toLowerCase().startsWith(cleanTitle)) {
    return firstSentence.slice(0, 240);
  }

  return `${title} made from the imported menu description and converted into a structured draft recipe.`;
}

function extractIngredientCandidates(text: string, title: string) {
  const source = `${title}. ${text}`.toLowerCase();
  const chunks = source
    .replace(/[()]/g, " ")
    .split(/[,.;:]|\band\b|\bwith\b|\bover\b|\bplus\b|\bserved with\b|\btopped with\b|\bdrizzled with\b/gi)
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 1 && item.length < 60);

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const chunk of chunks) {
    if (/[0-9]{3,}/.test(chunk)) {
      continue;
    }

    const lower = chunk.toLowerCase();
    const hasIngredientKeyword = INGREDIENT_KEYWORDS.some((keyword) => lower.includes(keyword));
    const hasVerb = COOKING_VERBS.some((verb) => lower.includes(`${verb} `) || lower.startsWith(`${verb} `));

    if (!hasIngredientKeyword || hasVerb) {
      continue;
    }

    const cleaned = lower
      .replace(/^(this|that|these|those|fresh|homemade|organic|weekly|extra|mixed|assorted)\s+/g, "")
      .replace(/\b(to enjoy|for you|during the week|is included in your order)\b.*$/g, "")
      .replace(/[^a-z' -]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length < 3 || cleaned.length > 40) {
      continue;
    }

    if (seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    candidates.push(titleCase(cleaned));
  }

  const prioritized = candidates.filter((candidate) =>
    !["Weekly Salad", "Salad", "Smoothie", "Soup"].includes(candidate),
  );

  return (prioritized.length > 0 ? prioritized : candidates).slice(0, 14);
}

function buildInstructions(text: string) {
  const sentences = splitSentences(text);
  const actionable = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return COOKING_VERBS.some((verb) => lower.includes(verb));
  });

  const chosen = actionable.slice(0, 5);
  const steps = chosen.map((sentence) => {
    const clean = sentence.replace(/\s+/g, " ").trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  });

  if (steps.length < 3) {
    steps.unshift("Review the imported starter text and confirm the final ingredient quantities for service.");
  }

  if (steps.length < 4) {
    steps.push("Cook the primary components until the protein, vegetables, and starches reach service-ready doneness.");
  }

  if (steps.length < 5) {
    steps.push("Finish with the garnishes, sauces, and sides referenced in the starter description before packing or plating.");
  }

  return steps.slice(0, 6);
}

export function createRecipeDraft(title: string, sourceText?: string | null): RecipeDraft {
  const cleanSource = cleanRecipeSourceText(sourceText || title);
  const ingredients = extractIngredientCandidates(cleanSource, title);
  const instructions = buildInstructions(cleanSource);

  return {
    summary: buildSummary(title, cleanSource),
    ingredientsText: ingredients.map((item) => `- ${item}`).join("\n"),
    instructionsText: instructions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
  };
}
