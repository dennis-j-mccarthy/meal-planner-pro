import Link from "next/link";
import { RecipeCard } from "@/components/recipe-card";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { formatMinutes } from "@/lib/format";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type RecipesPageProps = {
  searchParams?: Promise<{
    q?: string;
    tag?: string;
    starred?: string;
    used?: string;
  }>;
};

function splitTags(...values: Array<string | null | undefined>) {
  return values
    .flatMap((value) => (value ? value.split(",") : []))
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildFilterHref(currentSearch: string, nextTag?: string | null) {
  const params = new URLSearchParams();
  if (currentSearch) params.set("q", currentSearch);
  if (nextTag) params.set("tag", nextTag);
  const query = params.toString();
  return query ? `/recipes?${query}` : "/recipes";
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q?.trim() ?? "";
  const activeTag = resolvedSearchParams?.tag?.trim() ?? "";
  const showStarred = resolvedSearchParams?.starred === "1";
  const showUsed = resolvedSearchParams?.used === "1";
  const kitchen = await getKitchen();

  // Get recipe IDs that have been used in proposals or menu cards
  let usedRecipeIds: Set<string> | null = null;
  if (showUsed) {
    const [proposalRecipes, menuCardRecipes] = await Promise.all([
      prisma.proposalRecipe.findMany({
        where: { proposal: { kitchenId: kitchen.id } },
        select: { recipeId: true },
        distinct: ["recipeId"],
      }),
      prisma.menuCardRecipe.findMany({
        where: { menuCard: { kitchenId: kitchen.id } },
        select: { recipeId: true },
        distinct: ["recipeId"],
      }),
    ]);
    usedRecipeIds = new Set([
      ...proposalRecipes.map((r) => r.recipeId),
      ...menuCardRecipes.map((r) => r.recipeId),
    ]);
  }

  const [recipes] = await Promise.all([
    prisma.recipe.findMany({
      where: {
        kitchenId: kitchen.id,
        ...(showStarred ? { starred: true } : {}),
        ...(usedRecipeIds ? { id: { in: [...usedRecipeIds] } } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query } },
                { description: { contains: query } },
                { cuisine: { contains: query } },
                { tags: { contains: query } },
                { dietaryFlags: { contains: query } },
              ],
            }
          : {}),
        ...(activeTag
          ? {
              OR: [
                { tags: { contains: activeTag } },
                { dietaryFlags: { contains: activeTag } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Tag cloud
  const allRecipes = await prisma.recipe.findMany({
    where: { kitchenId: kitchen.id },
    select: { tags: true, dietaryFlags: true },
  });
  const tagCounts = new Map<string, number>();
  for (const recipe of allRecipes) {
    for (const tag of new Set(splitTags(recipe.tags, recipe.dietaryFlags))) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 18);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Recipes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
            {activeTag && ` · ${activeTag}`}
            {query && ` · "${query}"`}
          </p>
        </div>
        <AddRecipeModal />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <form className="flex gap-2 flex-1 min-w-64">
          <input
            className="field flex-1"
            defaultValue={query}
            name="q"
            placeholder="Search recipes..."
            type="search"
          />
          <button className="button-primary text-sm" type="submit">
            Search
          </button>
          {(query || activeTag || showStarred || showUsed) && (
            <Link className="button-secondary text-sm" href="/recipes">
              Clear
            </Link>
          )}
        </form>

        {/* Quick filters */}
        <div className="flex gap-1.5">
          <Link
            href={showStarred ? "/recipes" : "/recipes?starred=1"}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              showStarred
                ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200"
                : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-500"
            }`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill={showStarred ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={showStarred ? 0 : 2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
              />
            </svg>
            Starred
          </Link>
          <Link
            href={showUsed ? "/recipes" : "/recipes?used=1"}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              showUsed
                ? "bg-[var(--accent-light)] text-[var(--accent)] ring-1 ring-[var(--accent)]"
                : "bg-slate-100 text-slate-500 hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
            }`}
          >
            Previously used
          </Link>
        </div>
      </div>

      {/* Tag cloud */}
      {topTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              !activeTag
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            href={buildFilterHref(query, null)}
          >
            All
          </Link>
          {topTags.map(([tag, count]) => (
            <Link
              key={tag}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                activeTag.toLowerCase() === tag.toLowerCase()
                  ? "bg-[var(--accent)] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              href={buildFilterHref(query, tag)}
            >
              {tag} ({count})
            </Link>
          ))}
        </div>
      )}

      {/* Recipe grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {recipes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
            No recipes match the current filters.
          </div>
        ) : (
          recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={{
                id: recipe.id,
                title: recipe.title,
                cuisine: recipe.cuisine,
                description: recipe.description,
                prepMinutes: recipe.prepMinutes,
                cookMinutes: recipe.cookMinutes,
                servings: recipe.servings,
                ingredientsText: recipe.ingredientsText,
                tags: recipe.tags,
                dietaryFlags: recipe.dietaryFlags,
                timingLabel: formatMinutes(
                  recipe.prepMinutes,
                  recipe.cookMinutes,
                ),
                starred: recipe.starred,
                imageUrl: recipe.imageUrl,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
