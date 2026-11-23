// Server-only data layer for the meal-plan builder: client history (what
// they were served and kept), finder search, and the fill/swap candidate
// ranking. Every query is scoped by kitchenId; callers pass the kitchen they
// got from requireKitchen().
import "server-only";
import { format } from "date-fns";
import { parseDishQuota, type DishQuotaRow } from "@/lib/dish-quota";
import { prisma } from "@/lib/prisma";
import {
  compileExclusions,
  findConflict,
  matchesInclusions,
  parseKeywords,
  RECENT_DAYS,
  resolveSlot,
  SERVED_BADGE_DAYS,
  slotNames,
  type ExclusionTerm,
  type PlannerDish,
  type PlannerFilters,
  type RecipeHit,
} from "./planner-logic";

const DAY_MS = 24 * 60 * 60 * 1000;

type HistoryMenu = {
  date: Date;
  createdAt: Date;
  cookDateId: string | null;
  kind: "card" | "approved" | "proposal";
  dishes: Array<{ recipeId: string; label: string | null }>;
};

export type PlannerContext = {
  kitchenId: string;
  proposal: { id: string; status: string; cookDateId: string };
  client: {
    id: string;
    firstName: string;
    exclusions: string | null;
    dietaryNotes: string | null;
  };
  refDate: Date;
  quota: DishQuotaRow[];
  slots: string[];
  terms: ExclusionTerm[];
  inclusionWords: string[];
  /** Recipe ids currently on this proposal. */
  menuRecipeIds: Set<string>;
  lastServed: Map<string, Date>;
  timesKept: Map<string, { count: number; label: string | null }>;
  keptLastTime: Set<string>;
  /** The client's most recent menu before this cook date (for "Start from last menu"). */
  lastMenu: HistoryMenu | null;
  /** Each recipe's most-used course on this kitchen's past menus (fallback when tags say nothing). */
  usualCourse: Map<string, string>;
};

export async function loadPlannerContext(
  kitchenId: string,
  proposalId: string,
): Promise<PlannerContext | null> {
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, kitchenId },
    select: {
      id: true,
      status: true,
      cookDateId: true,
      cookDate: {
        select: {
          scheduledFor: true,
          client: {
            select: {
              id: true,
              firstName: true,
              exclusions: true,
              inclusions: true,
              dietaryNotes: true,
              dishQuota: true,
            },
          },
        },
      },
      recipes: { select: { recipeId: true } },
    },
  });
  if (!proposal) return null;

  const client = proposal.cookDate.client;
  const refDate = proposal.cookDate.scheduledFor;

  const [cards, proposals, proposalCourses, cardCourses] = await Promise.all([
    prisma.menuCard.findMany({
      where: { kitchenId, clientId: client.id },
      select: {
        menuDate: true,
        createdAt: true,
        cookDateId: true,
        recipes: { select: { recipeId: true, category: true }, orderBy: { position: "asc" } },
      },
    }),
    prisma.proposal.findMany({
      where: { kitchenId, cookDate: { clientId: client.id }, id: { not: proposal.id } },
      select: {
        status: true,
        createdAt: true,
        cookDateId: true,
        cookDate: { select: { scheduledFor: true } },
        recipes: {
          select: { recipeId: true, courseLabel: true, clientRemoved: true },
          orderBy: { position: "asc" },
        },
      },
    }),
    prisma.proposalRecipe.groupBy({
      by: ["recipeId", "courseLabel"],
      where: { proposal: { kitchenId }, courseLabel: { not: null } },
      _count: { _all: true },
    }),
    prisma.menuCardRecipe.groupBy({
      by: ["recipeId", "category"],
      where: { menuCard: { kitchenId }, category: { not: null } },
      _count: { _all: true },
    }),
  ]);

  // Most-used course per recipe across every menu in the kitchen.
  const courseTally = new Map<string, Map<string, number>>();
  const tally = (recipeId: string, label: string | null, n: number) => {
    if (!label) return;
    const perRecipe = courseTally.get(recipeId) ?? new Map<string, number>();
    perRecipe.set(label, (perRecipe.get(label) ?? 0) + n);
    courseTally.set(recipeId, perRecipe);
  };
  for (const row of proposalCourses) tally(row.recipeId, row.courseLabel, row._count._all);
  for (const row of cardCourses) tally(row.recipeId, row.category, row._count._all);
  const usualCourse = new Map<string, string>();
  for (const [recipeId, labels] of courseTally) {
    const best = [...labels.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) usualCourse.set(recipeId, best[0]);
  }

  // One menu per cook date: the Bon Appetit if there is one (approval creates
  // it from the approved proposal, so counting both would double up), else
  // the approved proposal, else the newest proposal. Menu cards without a
  // cook date stand alone. This cook date and anything after it are ignored.
  const byCookDate = new Map<string, HistoryMenu>();
  const loose: HistoryMenu[] = [];
  const rank = { card: 3, approved: 2, proposal: 1 } as const;
  const consider = (menu: HistoryMenu) => {
    if (menu.cookDateId === proposal.cookDateId) return;
    if (menu.date.getTime() >= refDate.getTime()) return;
    if (!menu.cookDateId) {
      loose.push(menu);
      return;
    }
    const existing = byCookDate.get(menu.cookDateId);
    if (
      !existing ||
      rank[menu.kind] > rank[existing.kind] ||
      (rank[menu.kind] === rank[existing.kind] && menu.createdAt > existing.createdAt)
    ) {
      byCookDate.set(menu.cookDateId, menu);
    }
  };

  for (const card of cards) {
    consider({
      date: card.menuDate,
      createdAt: card.createdAt,
      cookDateId: card.cookDateId,
      kind: "card",
      dishes: card.recipes.map((r) => ({ recipeId: r.recipeId, label: r.category })),
    });
  }
  for (const p of proposals) {
    consider({
      date: p.cookDate.scheduledFor,
      createdAt: p.createdAt,
      cookDateId: p.cookDateId,
      kind: p.status === "APPROVED" ? "approved" : "proposal",
      dishes: p.recipes
        .filter((r) => !r.clientRemoved)
        .map((r) => ({ recipeId: r.recipeId, label: r.courseLabel })),
    });
  }

  const allMenus = [...byCookDate.values(), ...loose].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime(),
  );
  // "Served" and "kept" only count menus that actually happened.
  const served = allMenus.filter((m) => m.kind !== "proposal");

  const lastServed = new Map<string, Date>();
  const timesKept = new Map<string, { count: number; label: string | null }>();
  for (const menu of served) {
    for (const dish of menu.dishes) {
      const prev = lastServed.get(dish.recipeId);
      if (!prev || menu.date > prev) lastServed.set(dish.recipeId, menu.date);
      const kept = timesKept.get(dish.recipeId);
      timesKept.set(dish.recipeId, {
        count: (kept?.count ?? 0) + 1,
        label: kept?.label ?? dish.label,
      });
    }
  }

  const quota = parseDishQuota(client.dishQuota);

  return {
    kitchenId,
    proposal: { id: proposal.id, status: proposal.status, cookDateId: proposal.cookDateId },
    client: {
      id: client.id,
      firstName: client.firstName,
      exclusions: client.exclusions,
      dietaryNotes: client.dietaryNotes,
    },
    refDate,
    quota,
    slots: slotNames(quota),
    terms: compileExclusions(client.exclusions),
    inclusionWords: parseKeywords(client.inclusions),
    menuRecipeIds: new Set(proposal.recipes.map((r) => r.recipeId)),
    lastServed,
    timesKept,
    keptLastTime: new Set(served[0]?.dishes.map((d) => d.recipeId) ?? []),
    lastMenu: allMenus.find((m) => m.dishes.length > 0) ?? null,
    usualCourse,
  };
}

export function shortDate(date: Date): string {
  return format(date, "MMM d");
}

function daysBefore(ctx: PlannerContext, date: Date): number {
  return (ctx.refDate.getTime() - date.getTime()) / DAY_MS;
}

type DishRow = {
  id: string;
  recipeId: string;
  courseLabel: string | null;
  position: number;
  clientRemoved: boolean;
  recipe: { title: string; description: string | null; tags: string | null; dietaryFlags: string | null };
};

export const dishSelect = {
  id: true,
  recipeId: true,
  courseLabel: true,
  position: true,
  clientRemoved: true,
  recipe: { select: { title: true, description: true, tags: true, dietaryFlags: true } },
} as const;

export function toPlannerDish(row: DishRow, ctx: PlannerContext): PlannerDish {
  const served = ctx.lastServed.get(row.recipeId);
  return {
    id: row.id,
    recipeId: row.recipeId,
    title: row.recipe.title,
    description: row.recipe.description,
    tags: row.recipe.tags,
    courseLabel: row.courseLabel,
    position: row.position,
    keptLastTime: ctx.keptLastTime.has(row.recipeId),
    servedLabel: served && daysBefore(ctx, served) <= SERVED_BADGE_DAYS ? shortDate(served) : null,
    clientRemoved: row.clientRemoved,
    conflict: findConflict(row.recipe, ctx.terms),
  };
}

export async function loadPlannerDishes(ctx: PlannerContext): Promise<PlannerDish[]> {
  const rows = await prisma.proposalRecipe.findMany({
    where: { proposalId: ctx.proposal.id, proposal: { kitchenId: ctx.kitchenId } },
    select: dishSelect,
    orderBy: { position: "asc" },
  });
  return rows.map((r) => toPlannerDish(r, ctx));
}

type LibraryRow = {
  id: string;
  title: string;
  description: string | null;
  tags: string | null;
  dietaryFlags: string | null;
  starred: boolean;
};

const librarySelect = {
  id: true,
  title: true,
  description: true,
  tags: true,
  dietaryFlags: true,
  starred: true,
} as const;

export function toHit(recipe: LibraryRow, ctx: PlannerContext): RecipeHit {
  const served = ctx.lastServed.get(recipe.id);
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    starred: recipe.starred,
    category: resolveSlot(ctx.usualCourse.get(recipe.id) ?? null, recipe.tags, ctx.slots),
    lastServedLabel: served ? shortDate(served) : null,
    recentlyServed: !!served && daysBefore(ctx, served) <= RECENT_DAYS,
    conflict: findConflict(recipe, ctx.terms),
    timesKept: ctx.timesKept.get(recipe.id)?.count ?? 0,
  };
}

export async function loadLibrary(kitchenId: string, ids?: string[]): Promise<LibraryRow[]> {
  return prisma.recipe.findMany({
    where: { kitchenId, ...(ids ? { id: { in: ids } } : {}) },
    select: librarySelect,
  });
}

function textScore(recipe: LibraryRow, words: string[]): number {
  const title = recipe.title.toLowerCase();
  const tags = (recipe.tags ?? "").toLowerCase();
  let score = 0;
  if (words.length > 0 && title.startsWith(words[0])) score += 4;
  if (words.every((w) => title.includes(w))) score += 3;
  score += words.filter((w) => tags.includes(w)).length;
  return score;
}

export type SearchResult = { results: RecipeHit[]; hidden: RecipeHit[] };

/**
 * Finder search within the kitchen's library. With a query, hits hidden by
 * the client filters come back separately so the UI can explain them.
 */
export async function plannerSearch(
  ctx: PlannerContext,
  rawQuery: string,
  filters: PlannerFilters,
): Promise<SearchResult> {
  const query = rawQuery.trim().toLowerCase().slice(0, 80);
  const words = query.split(/\s+/).filter(Boolean).slice(0, 6);
  const category = filters.category && ctx.slots.includes(filters.category) ? filters.category : null;

  const rows = await prisma.recipe.findMany({
    where: {
      kitchenId: ctx.kitchenId,
      ...(words.length > 0
        ? {
            AND: words.map((w) => ({
              OR: [
                { title: { contains: w, mode: "insensitive" as const } },
                { description: { contains: w, mode: "insensitive" as const } },
                { tags: { contains: w, mode: "insensitive" as const } },
              ],
            })),
          }
        : {}),
    },
    select: librarySelect,
    take: words.length > 0 ? 300 : 3000,
  });

  const scored = rows
    .filter((r) => !ctx.menuRecipeIds.has(r.id))
    .map((r) => {
      const hit = toHit(r, ctx);
      let score: number;
      if (words.length > 0) {
        score =
          textScore(r, words) +
          (category && hit.category === category ? 2 : 0) +
          (hit.starred ? 0.5 : 0) +
          Math.min(hit.timesKept, 3) * 0.3;
      } else {
        score =
          (hit.starred ? 3 : 0) +
          Math.min(hit.timesKept, 3) +
          (hit.lastServedLabel ? 0 : 0.5) +
          (matchesInclusions(r, ctx.inclusionWords) ? 1 : 0);
      }
      return { hit, score };
    })
    .filter(({ hit }) => words.length > 0 || !category || hit.category === category)
    .sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title));

  const results: RecipeHit[] = [];
  const hidden: RecipeHit[] = [];
  for (const { hit } of scored) {
    const blocked = (filters.safeOnly && hit.conflict) || (filters.notRecent && hit.recentlyServed);
    if (blocked) {
      if (words.length > 0 && hidden.length < 8) hidden.push(hit);
    } else if (results.length < 40) {
      results.push(hit);
    }
    if (results.length >= 40 && (words.length === 0 || hidden.length >= 8)) break;
  }
  return { results, hidden };
}

/**
 * Best safe, not-recently-served recipes for a slot, favouring starred
 * recipes, the client's inclusions and dishes they kept before. A little
 * randomness keeps repeat clicks from always offering the same three.
 */
export function rankCandidates(
  library: LibraryRow[],
  ctx: PlannerContext,
  slot: string,
  exclude: Set<string>,
): RecipeHit[] {
  return library
    .filter((r) => !exclude.has(r.id))
    .map((r) => ({ r, hit: toHit(r, ctx) }))
    .filter(({ hit }) => hit.category === slot && !hit.conflict && !hit.recentlyServed)
    .map(({ r, hit }) => ({
      hit,
      score:
        (hit.starred ? 3 : 0) +
        (matchesInclusions(r, ctx.inclusionWords) ? 2 : 0) +
        (hit.timesKept > 0 ? 1 : 0) +
        (hit.lastServedLabel ? 0 : 0.5) +
        Math.random() * 1.5,
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ hit }) => hit);
}
