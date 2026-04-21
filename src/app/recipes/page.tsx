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

  const [recipes, totalCount, starredCount] = await Promise.all([
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
    prisma.recipe.count({ where: { kitchenId: kitchen.id } }),
    prisma.recipe.count({ where: { kitchenId: kitchen.id, starred: true } }),
  ]);

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
    .slice(0, 20);

  const hasFilters = query || activeTag || showStarred || showUsed;

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 px-8 py-10 border border-orange-100">
        {/* Decorative blobs */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-orange-200/40 to-pink-200/40 blur-3xl" />
        <div className="absolute -left-16 -bottom-20 h-56 w-56 rounded-full bg-gradient-to-br from-amber-200/40 to-yellow-100/40 blur-3xl" />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600/80 mb-2">
              Your library
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Recipes
            </h1>
            <p className="mt-3 text-base text-slate-600 max-w-xl">
              {totalCount.toLocaleString()} recipes ready to inspire your next
              menu. Search, filter, or discover something new.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Stat chips */}
            <div className="flex gap-3">
              <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/80 px-4 py-3 shadow-sm">
                <p className="text-2xl font-bold text-slate-900">{totalCount.toLocaleString()}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
              </div>
              <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/80 px-4 py-3 shadow-sm">
                <p className="text-2xl font-bold text-amber-600">{starredCount}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Starred</p>
              </div>
            </div>

            <AddRecipeModal />
          </div>
        </div>
      </section>

      {/* Search + filter bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="flex items-center gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-base outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 focus:bg-white transition-all"
              defaultValue={query}
              name="q"
              placeholder="Search by title, cuisine, ingredient, or tag..."
              type="search"
            />
          </div>
          <button className="button-primary text-sm px-5" type="submit">
            Search
          </button>
          {hasFilters && (
            <Link className="button-secondary text-sm" href="/recipes">
              Clear all
            </Link>
          )}
        </form>

        {/* Quick filter chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Quick filters:
          </span>
          <Link
            href={showStarred ? "/recipes" : "/recipes?starred=1"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              showStarred
                ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-amber-50 hover:text-amber-600"
            }`}
          >
            <svg
              className="h-3.5 w-3.5"
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
            Starred ({starredCount})
          </Link>
          <Link
            href={showUsed ? "/recipes" : "/recipes?used=1"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              showUsed
                ? "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Previously used
          </Link>
        </div>

        {/* Tag cloud */}
        {topTags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 pt-4 border-t border-slate-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 self-center">
              Tags:
            </span>
            <Link
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                !activeTag
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
              href={buildFilterHref(query, null)}
            >
              All
            </Link>
            {topTags.map(([tag, count]) => (
              <Link
                key={tag}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  activeTag.toLowerCase() === tag.toLowerCase()
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                }`}
                href={buildFilterHref(query, tag)}
              >
                {tag} <span className="opacity-60">({count})</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Result count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">
            {recipes.length.toLocaleString()}
          </span>{" "}
          {recipes.length === 1 ? "recipe" : "recipes"}
          {activeTag && <> matching <span className="font-semibold">{activeTag}</span></>}
          {query && <> for &ldquo;<span className="font-semibold">{query}</span>&rdquo;</>}
        </p>
      </div>

      {/* Recipe grid */}
      {recipes.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 px-4 py-16 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-700 mb-1">
            No recipes found
          </p>
          <p className="text-sm text-slate-500 mb-4">
            Try a different search, clear filters, or add a new recipe.
          </p>
          {hasFilters && (
            <Link className="button-secondary text-sm" href="/recipes">
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {recipes.map((recipe) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
