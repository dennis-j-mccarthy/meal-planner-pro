"use server";

// Server actions for the meal-plan builder (/proposals/[proposalId]).
// Every export is a public endpoint: each one starts with requireKitchen(),
// checks its arguments at runtime, and scopes every read and write to the
// caller's kitchen (ProposalRecipe rows through their proposal). Errors the
// chef should see come back as { ok: false, error } — thrown messages are
// redacted in production.
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import {
  isEditableStatus,
  MAX_CATEGORY_LENGTH,
  openSlots,
  resolveSlot,
  type PlannerDish,
  type PlannerFilters,
  type RecipeHit,
} from "@/components/planner/planner-logic";
import {
  dishSelect,
  loadLibrary,
  loadPlannerContext,
  loadPlannerDishes,
  plannerSearch,
  rankCandidates,
  shortDate,
  toHit,
  toPlannerDish,
  type PlannerContext,
} from "@/components/planner/planner-server";

type Fail = { ok: false; error: string };
type Result<T> = ({ ok: true } & T) | Fail;

const LOCKED = "This menu can't be changed right now. Mark it “Client wants changes” to edit it again.";

function fail(error: string): Fail {
  return { ok: false, error };
}

function id(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}

function category(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, MAX_CATEGORY_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

async function editableContext(kitchenId: string, proposalId: unknown): Promise<PlannerContext | Fail> {
  const pid = id(proposalId);
  if (!pid) return fail("Menu not found.");
  const ctx = await loadPlannerContext(kitchenId, pid);
  if (!ctx) return fail("Menu not found.");
  if (!isEditableStatus(ctx.proposal.status)) return fail(LOCKED);
  return ctx;
}

/** The ProposalRecipe row, only if it belongs to this kitchen. */
async function ownedDish(kitchenId: string, proposalRecipeId: unknown) {
  const prid = id(proposalRecipeId);
  if (!prid) return null;
  return prisma.proposalRecipe.findFirst({
    where: { id: prid, proposal: { kitchenId } },
    select: { id: true, proposalId: true, recipeId: true, courseLabel: true, position: true },
  });
}

async function nextPosition(proposalId: string): Promise<number> {
  const max = await prisma.proposalRecipe.aggregate({
    where: { proposalId },
    _max: { position: true },
  });
  return (max._max.position ?? 0) + 1;
}

/** Insert several dishes (skipping any already on the menu) and return them. */
async function insertDishes(
  ctx: PlannerContext,
  items: Array<{ recipeId: string; courseLabel: string | null }>,
): Promise<PlannerDish[]> {
  const fresh = items.filter(
    (item, i) => !ctx.menuRecipeIds.has(item.recipeId) && items.findIndex((x) => x.recipeId === item.recipeId) === i,
  );
  if (fresh.length === 0) return [];
  let position = await nextPosition(ctx.proposal.id);
  const created = await prisma.proposalRecipe.createManyAndReturn({
    data: fresh.map((item) => ({
      proposalId: ctx.proposal.id,
      recipeId: item.recipeId,
      courseLabel: item.courseLabel,
      position: position++,
    })),
    skipDuplicates: true,
    select: { id: true },
  });
  const rows = await prisma.proposalRecipe.findMany({
    where: { id: { in: created.map((c) => c.id) }, proposalId: ctx.proposal.id },
    select: dishSelect,
    orderBy: { position: "asc" },
  });
  for (const row of rows) ctx.menuRecipeIds.add(row.recipeId);
  return rows.map((r) => toPlannerDish(r, ctx));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function skippedNote(skipped: Array<{ title: string; conflict: string }>): string {
  if (skipped.length === 0) return "";
  const first = skipped[0];
  return skipped.length === 1
    ? ` Skipped “${first.title}” (contains ${first.conflict}).`
    : ` Skipped ${skipped.length} that contain ${[...new Set(skipped.map((s) => s.conflict))].join(", ")}.`;
}

type DraftResult = Result<{ added: PlannerDish[]; message: string }>;

// ------------------------------------------------------------ draft buttons

/** Copy the dishes from this client's most recent menu before this cook date. */
export async function startFromLastMenu(proposalId: string): Promise<DraftResult> {
  const kitchen = await requireKitchen();
  const ctx = await editableContext(kitchen.id, proposalId);
  if ("ok" in ctx) return ctx;

  const last = ctx.lastMenu;
  if (!last) {
    return { ok: true, added: [], message: `No earlier menu for ${ctx.client.firstName} yet.` };
  }

  const library = await loadLibrary(
    kitchen.id,
    last.dishes.map((d) => d.recipeId),
  );
  const byId = new Map(library.map((r) => [r.id, r]));
  const skipped: Array<{ title: string; conflict: string }> = [];
  const items: Array<{ recipeId: string; courseLabel: string | null }> = [];
  for (const dish of last.dishes) {
    const recipe = byId.get(dish.recipeId);
    if (!recipe || ctx.menuRecipeIds.has(recipe.id)) continue;
    const hit = toHit(recipe, ctx);
    if (hit.conflict) {
      skipped.push({ title: recipe.title, conflict: hit.conflict });
      continue;
    }
    items.push({
      recipeId: recipe.id,
      courseLabel: resolveSlot(dish.label, recipe.tags, ctx.slots) ?? dish.label,
    });
  }

  const added = await insertDishes(ctx, items);
  const from = `the ${shortDate(last.date)} menu`;
  const message =
    added.length > 0
      ? `Added ${plural(added.length, "dish")} from ${from}.${skippedNote(skipped)}`
      : `Everything from ${from} is already here.${skippedNote(skipped)}`;
  return { ok: true, added, message };
}

/** Add the dishes this client has kept most often, into open slots. */
export async function addFavorites(proposalId: string): Promise<DraftResult> {
  const kitchen = await requireKitchen();
  const ctx = await editableContext(kitchen.id, proposalId);
  if ("ok" in ctx) return ctx;

  const favoriteIds = [...ctx.timesKept.entries()]
    .filter(([recipeId]) => !ctx.menuRecipeIds.has(recipeId))
    .sort((a, b) => b[1].count - a[1].count)
    .map(([recipeId]) => recipeId);
  if (favoriteIds.length === 0) {
    const none = ctx.timesKept.size === 0
      ? `${ctx.client.firstName} has no kept dishes yet.`
      : `All of ${ctx.client.firstName}'s favorites are already on the menu.`;
    return { ok: true, added: [], message: none };
  }

  const library = await loadLibrary(kitchen.id, favoriteIds);
  const byId = new Map(library.map((r) => [r.id, r]));
  const current = await loadPlannerDishes(ctx);
  const open = openSlots(current, ctx.quota);
  const hasQuota = ctx.quota.length > 0;
  let budget = hasQuota ? [...open.values()].reduce((a, b) => a + b, 0) : 6;

  const skipped: Array<{ title: string; conflict: string }> = [];
  const items: Array<{ recipeId: string; courseLabel: string | null }> = [];
  for (const recipeId of favoriteIds) {
    if (budget <= 0) break;
    const recipe = byId.get(recipeId);
    if (!recipe) continue;
    const hit = toHit(recipe, ctx);
    if (hit.conflict) {
      skipped.push({ title: recipe.title, conflict: hit.conflict });
      continue;
    }
    const label = ctx.timesKept.get(recipeId)?.label ?? null;
    const slot = resolveSlot(label, recipe.tags, ctx.slots);
    if (hasQuota) {
      if (!slot || (open.get(slot) ?? 0) <= 0) continue;
      open.set(slot, (open.get(slot) ?? 0) - 1);
    }
    items.push({ recipeId, courseLabel: slot ?? label });
    budget--;
  }

  const added = await insertDishes(ctx, items);
  let message: string;
  if (added.length > 0) {
    message = `Added ${plural(added.length, "favorite")}.${skippedNote(skipped)}`;
  } else if (hasQuota && [...open.values()].every((n) => n <= 0)) {
    message = `Those slots are already full — remove a dish to make room for a favorite.${skippedNote(skipped)}`;
  } else {
    message = `No favorites fit the open slots.${skippedNote(skipped)}`;
  }
  return { ok: true, added, message };
}

/** Fill every open quota slot with safe, not-recently-served recipes. */
export async function fillOpenSlots(proposalId: string): Promise<DraftResult> {
  const kitchen = await requireKitchen();
  const ctx = await editableContext(kitchen.id, proposalId);
  if ("ok" in ctx) return ctx;

  if (ctx.quota.length === 0) {
    return {
      ok: true,
      added: [],
      message: `${ctx.client.firstName} has no dish plan yet, so there are no slots to fill. Add one on the client page.`,
    };
  }

  const current = await loadPlannerDishes(ctx);
  const open = openSlots(current, ctx.quota);
  if (open.size === 0) {
    return { ok: true, added: [], message: "Every slot is already filled." };
  }

  const library = await loadLibrary(kitchen.id);
  const taken = new Set(ctx.menuRecipeIds);
  const items: Array<{ recipeId: string; courseLabel: string | null }> = [];
  const short: string[] = [];
  for (const [slot, count] of open) {
    const picks = rankCandidates(library, ctx, slot, taken).slice(0, count);
    for (const pick of picks) {
      taken.add(pick.id);
      items.push({ recipeId: pick.id, courseLabel: slot });
    }
    if (picks.length < count) short.push(slot);
  }

  const added = await insertDishes(ctx, items);
  const shortNote =
    short.length > 0 ? ` Not enough safe, fresh recipes for ${short.join(", ")} — add those by hand.` : "";
  const message =
    added.length > 0
      ? `Filled ${plural(added.length, "slot")}.${shortNote}`
      : `Couldn't find safe recipes that weren't served recently.${shortNote}`;
  return { ok: true, added, message };
}

/** Undo a draft button: delete the rows it just added. */
export async function undoAdds(proposalId: string, proposalRecipeIds: string[]): Promise<Result<object>> {
  const kitchen = await requireKitchen();
  const ctx = await editableContext(kitchen.id, proposalId);
  if ("ok" in ctx) return ctx;
  const ids = Array.isArray(proposalRecipeIds)
    ? proposalRecipeIds.map(id).filter((v): v is string => !!v).slice(0, 200)
    : [];
  if (ids.length === 0) return { ok: true };
  await prisma.proposalRecipe.deleteMany({
    where: { id: { in: ids }, proposalId: ctx.proposal.id, proposal: { kitchenId: kitchen.id } },
  });
  return { ok: true };
}

// ------------------------------------------------------------ single dishes

/** Add one recipe to the menu in a course. Already there = returns that row. */
export async function addDish(
  proposalId: string,
  recipeId: string,
  courseLabel: string | null,
): Promise<Result<{ dish: PlannerDish }>> {
  const kitchen = await requireKitchen();
  return addDishFor(kitchen.id, proposalId, recipeId, courseLabel);
}

/** Undo for removeDish: put the dish back at its old position. Nothing from the client is trusted. */
export async function restoreDish(
  proposalId: string,
  recipeId: string,
  courseLabel: string | null,
  position: number,
): Promise<Result<{ dish: PlannerDish }>> {
  const kitchen = await requireKitchen();
  return addDishFor(kitchen.id, proposalId, recipeId, courseLabel, position);
}

async function addDishFor(
  kitchenId: string,
  proposalId: unknown,
  recipeId: unknown,
  courseLabel: unknown,
  position?: unknown,
): Promise<Result<{ dish: PlannerDish }>> {
  const kitchen = { id: kitchenId };
  const ctx = await editableContext(kitchen.id, proposalId);
  if ("ok" in ctx) return ctx;
  const rid = id(recipeId);
  if (!rid) return fail("Recipe not found.");
  const recipe = await prisma.recipe.findFirst({
    where: { id: rid, kitchenId: kitchen.id },
    select: { id: true },
  });
  if (!recipe) return fail("Recipe not found.");

  const existing = await prisma.proposalRecipe.findFirst({
    where: { proposalId: ctx.proposal.id, recipeId: rid },
    select: dishSelect,
  });
  if (existing) return { ok: true, dish: toPlannerDish(existing, ctx) };

  const pos =
    typeof position === "number" && Number.isInteger(position) && position > 0 && position < 1_000_000
      ? position
      : await nextPosition(ctx.proposal.id);
  try {
    const row = await prisma.proposalRecipe.create({
      data: { proposalId: ctx.proposal.id, recipeId: rid, courseLabel: category(courseLabel), position: pos },
      select: dishSelect,
    });
    return { ok: true, dish: toPlannerDish(row, ctx) };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const row = await prisma.proposalRecipe.findFirst({
        where: { proposalId: ctx.proposal.id, recipeId: rid },
        select: dishSelect,
      });
      if (row) return { ok: true, dish: toPlannerDish(row, ctx) };
    }
    throw error;
  }
}

/** Remove a dish. Returns what Undo needs to put it back where it was. */
export async function removeDish(
  proposalRecipeId: string,
): Promise<Result<{ restore: { proposalId: string; recipeId: string; courseLabel: string | null; position: number } }>> {
  const kitchen = await requireKitchen();
  const dish = await ownedDish(kitchen.id, proposalRecipeId);
  if (!dish) return fail("That dish is already off the menu.");
  const ctx = await editableContext(kitchen.id, dish.proposalId);
  if ("ok" in ctx) return ctx;
  await prisma.proposalRecipe.deleteMany({
    where: { id: dish.id, proposal: { kitchenId: kitchen.id } },
  });
  return {
    ok: true,
    restore: {
      proposalId: dish.proposalId,
      recipeId: dish.recipeId,
      courseLabel: dish.courseLabel,
      position: dish.position,
    },
  };
}

/** Move a dish to another course (null = Other). */
export async function setDishCategory(
  proposalRecipeId: string,
  courseLabel: string | null,
): Promise<Result<object>> {
  const kitchen = await requireKitchen();
  const dish = await ownedDish(kitchen.id, proposalRecipeId);
  if (!dish) return fail("Dish not found.");
  const ctx = await editableContext(kitchen.id, dish.proposalId);
  if ("ok" in ctx) return ctx;
  await prisma.proposalRecipe.updateMany({
    where: { id: dish.id, proposal: { kitchenId: kitchen.id } },
    data: { courseLabel: category(courseLabel) },
  });
  return { ok: true };
}

/**
 * Drag and drop: save the menu's dish order (every dish id, in order) and,
 * optionally, a new course for the dish that was moved (null = Other).
 * The ids must be exactly this menu's dishes; positions are renumbered 1..n.
 */
export async function reorderDishes(
  proposalId: string,
  orderedIds: string[],
  moved?: { id: string; courseLabel: string | null } | null,
): Promise<Result<object>> {
  const kitchen = await requireKitchen();
  const ctx = await editableContext(kitchen.id, proposalId);
  if ("ok" in ctx) return ctx;
  if (!Array.isArray(orderedIds) || orderedIds.length > 500) return fail("Couldn't save the new order.");
  const ids = orderedIds.map(id);
  if (ids.some((x) => x === null) || new Set(ids).size !== ids.length) return fail("Couldn't save the new order.");

  const rows = await prisma.proposalRecipe.findMany({
    where: { proposalId: ctx.proposal.id, proposal: { kitchenId: kitchen.id } },
    select: { id: true },
  });
  const current = new Set(rows.map((r) => r.id));
  if (current.size !== ids.length || ids.some((x) => !current.has(x as string))) {
    return fail("The menu changed in another window. Reload the page and try again.");
  }

  const movedId = moved ? id(moved.id) : null;
  if (moved && (!movedId || !current.has(movedId))) return fail("Dish not found.");

  await prisma.$transaction(
    (ids as string[]).map((dishId, i) =>
      prisma.proposalRecipe.updateMany({
        where: { id: dishId, proposalId: ctx.proposal.id, proposal: { kitchenId: kitchen.id } },
        data:
          dishId === movedId
            ? { position: i + 1, courseLabel: category(moved?.courseLabel ?? null) }
            : { position: i + 1 },
      }),
    ),
  );
  return { ok: true };
}

/** Three safe alternatives from the same course as this dish. */
export async function suggestSwaps(proposalRecipeId: string): Promise<Result<{ options: RecipeHit[] }>> {
  const kitchen = await requireKitchen();
  const dish = await ownedDish(kitchen.id, proposalRecipeId);
  if (!dish) return fail("Dish not found.");
  const ctx = await editableContext(kitchen.id, dish.proposalId);
  if ("ok" in ctx) return ctx;

  const library = await loadLibrary(kitchen.id);
  const self = library.find((r) => r.id === dish.recipeId);
  const slot = resolveSlot(dish.courseLabel, self?.tags ?? null, ctx.slots);
  if (!slot) {
    return fail("Pick a course for this dish first, then Swap can suggest alternatives.");
  }
  const options = rankCandidates(library, ctx, slot, ctx.menuRecipeIds).slice(0, 3);
  return { ok: true, options };
}

/** Replace a dish's recipe in place (keeps its course and position). */
export async function swapDish(
  proposalRecipeId: string,
  newRecipeId: string,
): Promise<Result<{ dish: PlannerDish; previousRecipeId: string }>> {
  const kitchen = await requireKitchen();
  const dish = await ownedDish(kitchen.id, proposalRecipeId);
  if (!dish) return fail("Dish not found.");
  const ctx = await editableContext(kitchen.id, dish.proposalId);
  if ("ok" in ctx) return ctx;
  const rid = id(newRecipeId);
  if (!rid) return fail("Recipe not found.");
  if (rid === dish.recipeId) {
    const row = await prisma.proposalRecipe.findFirst({ where: { id: dish.id }, select: dishSelect });
    return row ? { ok: true, dish: toPlannerDish(row, ctx), previousRecipeId: dish.recipeId } : fail("Dish not found.");
  }
  const recipe = await prisma.recipe.findFirst({
    where: { id: rid, kitchenId: kitchen.id },
    select: { id: true },
  });
  if (!recipe) return fail("Recipe not found.");
  if (ctx.menuRecipeIds.has(rid)) return fail("That dish is already on the menu.");

  const { count } = await prisma.proposalRecipe.updateMany({
    where: { id: dish.id, proposal: { kitchenId: kitchen.id } },
    data: { recipeId: rid, clientRemoved: false },
  });
  if (count === 0) return fail("Dish not found.");
  const row = await prisma.proposalRecipe.findFirst({ where: { id: dish.id }, select: dishSelect });
  if (!row) return fail("Dish not found.");
  return { ok: true, dish: toPlannerDish(row, ctx), previousRecipeId: dish.recipeId };
}

// ------------------------------------------------------------ finder

/** Finder search: title/description/tags within the kitchen, with client safety + history. */
export async function searchRecipesForPlanner(
  proposalId: string,
  query: string,
  filters: PlannerFilters,
): Promise<Result<{ results: RecipeHit[]; hidden: RecipeHit[] }>> {
  const kitchen = await requireKitchen();
  const pid = id(proposalId);
  if (!pid) return fail("Menu not found.");
  const ctx = await loadPlannerContext(kitchen.id, pid);
  if (!ctx) return fail("Menu not found.");
  const safe: PlannerFilters = {
    safeOnly: filters?.safeOnly !== false,
    notRecent: filters?.notRecent !== false,
    category: category(filters?.category),
  };
  const result = await plannerSearch(ctx, typeof query === "string" ? query : "", safe);
  return { ok: true, ...result };
}

/** Fresh copy of the menu (after "Paste a list" adds dishes server-side). */
export async function reloadPlannerDishes(proposalId: string): Promise<Result<{ dishes: PlannerDish[] }>> {
  const kitchen = await requireKitchen();
  const pid = id(proposalId);
  if (!pid) return fail("Menu not found.");
  const ctx = await loadPlannerContext(kitchen.id, pid);
  if (!ctx) return fail("Menu not found.");
  return { ok: true, dishes: await loadPlannerDishes(ctx) };
}
