// Grocery lists: one cook date, or every cook date in a week, built from the
// final menu's recipes (scaled to the guests, merged, grouped by store
// section). Facts missing on those recipes are filled first, within a time
// budget, so the page always renders.
//
// Deliberately NOT a "use server" module. Every query is scoped to the
// kitchen passed in.
import { CookDateStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ensureRecipeFacts,
  finalMenuForCookDate,
  withTimeBudget,
  type FinalMenu,
} from "@/lib/recipe-facts";
import {
  formatAmounts,
  groceryListText,
  groupBySection,
  mergeGroceryEntries,
  parseCheckedKeys,
  parseIngredients,
  scaleFactor,
  type GroceryEntry,
  type GroceryGroup,
} from "@/lib/recipe-facts-format";

// Leave time for the page render itself.
const FACTS_BUDGET_MS = 25_000;

export type GroceryCookDate = {
  id: string;
  scheduledFor: Date;
  clientName: string;
  guests: number | null;
  dishCount: number;
  hasMenu: boolean;
};

export type GroceryList = {
  cookDates: GroceryCookDate[];
  groups: GroceryGroup[];
  // Keys checked off. For a week: checked on every cook date that needs it.
  checked: string[];
  // Dishes with no ingredients yet (AI unavailable or still working).
  missing: string[];
  dishCount: number;
};

type CookDateRow = {
  id: string;
  scheduledFor: Date;
  guestCount: number | null;
  groceryChecked: string | null;
  client: { firstName: string; lastName: string };
};

async function assemble(rows: CookDateRow[], kitchenId: string): Promise<GroceryList> {
  const menus = await Promise.all(
    rows.map(async (cd) => ({ cd, menu: await finalMenuForCookDate(cd.id, kitchenId) })),
  );
  const withMenu = menus.filter((m): m is { cd: CookDateRow; menu: FinalMenu } => m.menu !== null);

  const recipeIds = [...new Set(withMenu.flatMap((m) => m.menu.dishes.map((d) => d.recipeId)))];
  await withTimeBudget(ensureRecipeFacts(recipeIds, kitchenId), FACTS_BUDGET_MS);

  // Re-read after filling (the budget may have cut the fill short).
  const recipes = recipeIds.length
    ? await prisma.recipe.findMany({
        where: { id: { in: recipeIds }, kitchenId },
        select: { id: true, ingredientsText: true, servings: true },
      })
    : [];
  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  const entries: GroceryEntry[] = [];
  const missing = new Set<string>();
  let dishCount = 0;
  for (const { cd, menu } of withMenu) {
    const client = `${cd.client.firstName} ${cd.client.lastName}`.trim();
    for (const dish of menu.dishes) {
      dishCount++;
      const recipe = recipeById.get(dish.recipeId);
      const parsed = parseIngredients(recipe);
      if (parsed.items.length === 0) {
        missing.add(dish.title);
        continue;
      }
      // JSON quantities are written for their own yield; Beth's text for
      // Recipe.servings. Unknown either side → 1x.
      const base = parsed.source === "json" ? parsed.servings ?? recipe?.servings : recipe?.servings;
      const factor = scaleFactor(base, dish.servingsOverride ?? cd.guestCount);
      for (const ingredient of parsed.items) {
        entries.push({ ingredient, factor, dish: dish.title, client, cookDateId: cd.id });
      }
    }
  }

  const items = mergeGroceryEntries(entries);
  const checkedBy = new Map(rows.map((cd) => [cd.id, new Set(parseCheckedKeys(cd.groceryChecked))]));
  const checked = items
    .filter(
      (i) =>
        i.cookDateIds.length > 0 &&
        i.cookDateIds.every((id) => checkedBy.get(id)?.has(i.key)),
    )
    .map((i) => i.key);

  return {
    cookDates: menus.map(({ cd, menu }) => ({
      id: cd.id,
      scheduledFor: cd.scheduledFor,
      clientName: `${cd.client.firstName} ${cd.client.lastName}`.trim(),
      guests: cd.guestCount,
      dishCount: menu?.dishes.length ?? 0,
      hasMenu: !!menu,
    })),
    groups: groupBySection(items),
    checked,
    missing: [...missing],
    dishCount,
  };
}

const COOK_DATE_SELECT = {
  id: true,
  scheduledFor: true,
  guestCount: true,
  groceryChecked: true,
  client: { select: { firstName: true, lastName: true } },
} as const;

/** Grocery list for one cook date; null if it is not in this kitchen. */
export async function buildGroceryList(
  cookDateId: string,
  kitchenId: string,
): Promise<GroceryList | null> {
  const cd = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId },
    select: COOK_DATE_SELECT,
  });
  if (!cd) return null;
  return assemble([cd], kitchenId);
}

/** One combined list for every (non-cancelled) cook date in [start, end). */
export async function buildWeeklyGroceryList(
  start: Date,
  end: Date,
  kitchenId: string,
): Promise<GroceryList> {
  const rows = await prisma.cookDate.findMany({
    where: {
      kitchenId,
      scheduledFor: { gte: start, lt: end },
      status: { not: CookDateStatus.CANCELLED },
    },
    orderBy: { scheduledFor: "asc" },
    select: COOK_DATE_SELECT,
    take: 40,
  });
  return assemble(rows, kitchenId);
}

/** Checklist props for the client component, plus the clipboard text. */
export function toChecklist(list: GroceryList, mode: "cookDate" | "week", title: string) {
  const groups = list.groups.map((g) => ({
    section: g.section,
    items: g.items.map((i) => ({
      key: i.key,
      name: i.name,
      amount: formatAmounts(i),
      detail:
        mode === "week"
          ? i.clients.join(" · ")
          : i.dishes.length > 0
            ? `for ${i.dishes.join(", ")}`
            : "",
      cookDateIds: i.cookDateIds,
    })),
  }));
  return { groups, copyText: groceryListText(title, list.groups) };
}
