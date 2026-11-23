// Fills in structured ingredients + per-serving nutrition for the recipes a
// kitchen actually cooks: only dishes on a menu card or a final meal plan,
// never the whole library. One Gemini call per recipe, only for what is
// missing, and never over anything Beth entered.
//
// Storage formats and all parsing live in recipe-facts-format.ts.
//
// Deliberately NOT a "use server" module: every export of one becomes a
// publicly callable action. Every query is scoped to the kitchen passed in.
import { ProposalStatus } from "@/generated/prisma/client";
import { generateRecipeFactsJson } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import {
  ingredientsDisplayText,
  nutritionRows,
  parseIngredients,
  parseNutrition,
  sanitizeIngredient,
  sanitizeNutrition,
  sanitizeServings,
  serializeIngredientsJson,
  serializeNutrition,
  type Ingredient,
  type NutritionFacts,
  type NutritionRow,
  type ParsedIngredients,
} from "@/lib/recipe-facts-format";

const CONCURRENCY = 3;
// Gemini calls per ensure; the rest are picked up on the next visit.
const MAX_AI_CALLS_PER_RUN = 40;
const MAX_INGREDIENTS = 60;

export type RecipeFacts = {
  ingredients: ParsedIngredients;
  nutrition: NutritionFacts | null;
};

export type EnsureFactsResult = {
  checked: number;
  alreadyComplete: number;
  filled: number;
  failed: number;
  facts: Map<string, RecipeFacts>;
};

function isBlank(v: string | null | undefined): boolean {
  return !v || !v.trim();
}

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Resolves to the promise's value, or null on timeout or error. Never throws. */
export async function withTimeBudget<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise.catch(() => null), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * For each recipe (in this kitchen) missing structured ingredients or
 * nutrition, asks Gemini once and stores what was missing:
 *  - ingredientsText empty → structured "##json" ingredients.
 *  - ingredientsText is Beth's plain text → kept as-is (only nutrition added).
 *  - nutrition empty → {perServing, estimated:true, v:1}.
 * Writes are conditional on the field still holding the value read, so a
 * concurrent edit by Beth (or a second render) is never overwritten.
 */
export async function ensureRecipeFacts(
  recipeIds: string[],
  kitchenId: string,
): Promise<EnsureFactsResult> {
  const ids = [...new Set(recipeIds.filter(Boolean))];
  const result: EnsureFactsResult = {
    checked: 0,
    alreadyComplete: 0,
    filled: 0,
    failed: 0,
    facts: new Map(),
  };
  if (ids.length === 0) return result;

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: ids }, kitchenId },
    select: {
      id: true,
      title: true,
      description: true,
      ingredientsText: true,
      nutrition: true,
      servings: true,
    },
  });
  result.checked = recipes.length;

  // Ours (JSON) but unreadable counts as missing; Beth's text never does.
  // Present-but-unparseable nutrition is left alone (not ours to replace).
  const pending: {
    r: (typeof recipes)[number];
    ingredients: ParsedIngredients;
    nutrition: NutritionFacts | null;
    needIngredients: boolean;
    needNutrition: boolean;
  }[] = [];
  for (const r of recipes) {
    const ingredients = parseIngredients(r);
    const nutrition = parseNutrition(r);
    result.facts.set(r.id, { ingredients, nutrition });
    const needIngredients =
      isBlank(r.ingredientsText) || (ingredients.estimated && ingredients.items.length === 0);
    const needNutrition = isBlank(r.nutrition);
    if (needIngredients || needNutrition) {
      pending.push({ r, ingredients, nutrition, needIngredients, needNutrition });
    } else {
      result.alreadyComplete++;
    }
  }

  // Only the recipes that need an AI call are capped, so a big week never
  // starves the ones past the cap.
  await runPool(pending.slice(0, MAX_AI_CALLS_PER_RUN), CONCURRENCY, async (job) => {
    const { r, ingredients, nutrition, needIngredients, needNutrition } = job;

    try {
      const raw = await generateRecipeFactsJson({
        title: r.title,
        description: r.description,
        ingredientsText: needIngredients
          ? null
          : ingredientsDisplayText(r.ingredientsText, { includeEstimated: true }),
        servings: needIngredients
          ? r.servings
          : ingredients.source === "json"
            ? ingredients.servings
            : r.servings,
      });
      const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

      const servings = sanitizeServings(body.servings) ?? r.servings ?? null;
      const items = (Array.isArray(body.ingredients) ? body.ingredients : [])
        .map(sanitizeIngredient)
        .filter((i): i is Ingredient => i !== null)
        .slice(0, MAX_INGREDIENTS);
      const perServing = sanitizeNutrition(body.nutritionPerServing);

      let wrote = false;
      const next: RecipeFacts = { ingredients, nutrition };

      if (needIngredients && items.length > 0) {
        const stored = serializeIngredientsJson(servings, items);
        const { count } = await prisma.recipe.updateMany({
          where: { id: r.id, kitchenId, ingredientsText: r.ingredientsText },
          data: { ingredientsText: stored },
        });
        if (count > 0) {
          wrote = true;
          next.ingredients = parseIngredients(stored);
        }
      }

      if (needNutrition && perServing) {
        const stored = serializeNutrition(perServing);
        const { count } = await prisma.recipe.updateMany({
          where: { id: r.id, kitchenId, nutrition: r.nutrition },
          data: { nutrition: stored },
        });
        if (count > 0) {
          wrote = true;
          next.nutrition = perServing;
        }
      }

      result.facts.set(r.id, next);
      if (wrote) result.filled++;
      else result.failed++;
    } catch (e) {
      result.failed++;
      console.warn(
        `[recipe-facts] ${r.id} (${r.title}): ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  return result;
}

export type FinalDish = {
  recipeId: string;
  title: string;
  // ProposalRecipe.servingsOverride, when the meal plan set one.
  servingsOverride: number | null;
};

export type FinalMenu = {
  source: "menuCard" | "proposal";
  menuCardId: string | null;
  proposalId: string | null;
  dishes: FinalDish[];
};

/**
 * The dishes actually being cooked on a cook date: the Bon Appetit (menu card)
 * linked to it (accepted first, newest first), else the finalized meal plan,
 * else the newest approved meal plan; client-removed dishes excluded. Null when
 * there is no final menu yet.
 */
export async function finalMenuForCookDate(
  cookDateId: string,
  kitchenId: string,
): Promise<FinalMenu | null> {
  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId },
    select: {
      menuCards: {
        where: { kitchenId },
        orderBy: [{ accepted: "desc" }, { updatedAt: "desc" }],
        take: 1,
        select: {
          id: true,
          recipes: {
            orderBy: { position: "asc" },
            select: { recipeId: true, recipe: { select: { title: true } } },
          },
        },
      },
      finalizedProposal: {
        select: {
          id: true,
          kitchenId: true,
          recipes: {
            where: { clientRemoved: false },
            orderBy: { position: "asc" },
            select: { recipeId: true, servingsOverride: true, recipe: { select: { title: true } } },
          },
        },
      },
      proposals: {
        where: { kitchenId, status: ProposalStatus.APPROVED },
        orderBy: [{ approvedAt: "desc" }, { updatedAt: "desc" }],
        take: 1,
        select: {
          id: true,
          recipes: {
            where: { clientRemoved: false },
            orderBy: { position: "asc" },
            select: { recipeId: true, servingsOverride: true, recipe: { select: { title: true } } },
          },
        },
      },
    },
  });
  if (!cookDate) return null;

  const card = cookDate.menuCards[0];
  if (card && card.recipes.length > 0) {
    return {
      source: "menuCard",
      menuCardId: card.id,
      proposalId: null,
      dishes: card.recipes.map((mr) => ({
        recipeId: mr.recipeId,
        title: mr.recipe.title,
        servingsOverride: null,
      })),
    };
  }

  const finalized =
    cookDate.finalizedProposal && cookDate.finalizedProposal.kitchenId === kitchenId
      ? cookDate.finalizedProposal
      : null;
  const plan = finalized ?? cookDate.proposals[0] ?? null;
  if (plan && plan.recipes.length > 0) {
    return {
      source: "proposal",
      menuCardId: null,
      proposalId: plan.id,
      dishes: plan.recipes.map((pr) => ({
        recipeId: pr.recipeId,
        title: pr.recipe.title,
        servingsOverride: pr.servingsOverride,
      })),
    };
  }
  return null;
}

export async function ensureFactsForCookDate(
  cookDateId: string,
  kitchenId: string,
): Promise<EnsureFactsResult | null> {
  const menu = await finalMenuForCookDate(cookDateId, kitchenId);
  if (!menu) return null;
  return ensureRecipeFacts(
    menu.dishes.map((d) => d.recipeId),
    kitchenId,
  );
}

export async function ensureFactsForMenuCard(
  menuCardId: string,
  kitchenId: string,
): Promise<EnsureFactsResult | null> {
  const rows = await prisma.menuCardRecipe.findMany({
    where: { menuCardId, menuCard: { kitchenId } },
    select: { recipeId: true },
  });
  if (rows.length === 0) return null;
  return ensureRecipeFacts(
    rows.map((r) => r.recipeId),
    kitchenId,
  );
}

// Kitchen-neutral wording for the footer note (no chef's name).
export const NUTRITION_FOOTER_NOTE = "Estimated per serving from the recipes on this menu.";

export const BON_APPETIT_FACTS_BUDGET_MS = 20_000;

/**
 * Footer data for a Bon Appetit PDF. Fills missing facts first, but gives up
 * waiting after the time budget so a slow AI call never blocks the PDF, then
 * reads whatever nutrition is stored. Never throws; with no nutrition it
 * returns an empty list and the template leaves the footer out.
 *
 *   buildBonAppetitHtml({ ...(await bonAppetitNutrition(menuCard.id, kitchenId)), ... })
 */
export async function bonAppetitNutrition(
  menuCardId: string,
  kitchenId: string,
  budgetMs = BON_APPETIT_FACTS_BUDGET_MS,
): Promise<{ nutrition: NutritionRow[]; nutritionNote: string }> {
  try {
    await withTimeBudget(ensureFactsForMenuCard(menuCardId, kitchenId), budgetMs);
    const rows = await prisma.menuCardRecipe.findMany({
      where: { menuCardId, menuCard: { kitchenId } },
      orderBy: { position: "asc" },
      select: { recipe: { select: { title: true, nutrition: true } } },
    });
    return {
      nutrition: nutritionRows(rows.map((r) => r.recipe)),
      nutritionNote: NUTRITION_FOOTER_NOTE,
    };
  } catch (e) {
    console.warn(
      `[recipe-facts] nutrition footer skipped for ${menuCardId}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { nutrition: [], nutritionNote: NUTRITION_FOOTER_NOTE };
  }
}
