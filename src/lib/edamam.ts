const APP_ID = process.env.EDAMAM_APP_ID!;
const APP_KEY = process.env.EDAMAM_APP_KEY!;
const BASE_URL = "https://api.edamam.com/api/recipes/v2";

export const HEALTH_LABELS = [
  "alcohol-free",
  "celery-free",
  "crustacean-free",
  "dairy-free",
  "egg-free",
  "fish-free",
  "gluten-free",
  "keto-friendly",
  "kidney-friendly",
  "kosher",
  "low-sugar",
  "lupine-free",
  "Mediterranean",
  "mollusk-free",
  "mustard-free",
  "no-oil-added",
  "paleo",
  "peanut-free",
  "pescatarian",
  "pork-free",
  "sesame-free",
  "shellfish-free",
  "soy-free",
  "sugar-conscious",
  "tree-nut-free",
  "vegan",
  "vegetarian",
  "wheat-free",
] as const;

export const DIET_LABELS = [
  "balanced",
  "high-fiber",
  "high-protein",
  "low-carb",
  "low-fat",
  "low-sodium",
] as const;

export interface EdamamRecipe {
  uri: string;
  label: string;
  image: string;
  source: string;
  url: string;
  yield: number;
  dietLabels: string[];
  healthLabels: string[];
  ingredientLines: string[];
  calories: number;
  totalTime: number;
  cuisineType: string[];
  mealType: string[];
  dishType: string[];
}

export interface EdamamSearchResult {
  recipes: EdamamRecipe[];
  count: number;
}

export async function searchEdamamRecipes(params: {
  query: string;
  health?: string[];
  diet?: string[];
  from?: number;
  to?: number;
}): Promise<EdamamSearchResult> {
  const url = new URL(BASE_URL);
  url.searchParams.set("type", "public");
  url.searchParams.set("app_id", APP_ID);
  url.searchParams.set("app_key", APP_KEY);
  url.searchParams.set("q", params.query);

  if (params.health) {
    for (const h of params.health) {
      url.searchParams.append("health", h);
    }
  }
  if (params.diet) {
    for (const d of params.diet) {
      url.searchParams.append("diet", d);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { "Edamam-Account-User": APP_ID },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Edamam API error: ${res.status}`);
  }

  const data = await res.json();

  return {
    count: data.count ?? 0,
    recipes: (data.hits ?? []).map(
      (hit: { recipe: EdamamRecipe }) => hit.recipe,
    ),
  };
}
