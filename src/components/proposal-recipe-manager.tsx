"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { addRecipeToProposal, removeRecipeFromProposal, updateProposalRecipeCategory } from "@/app/actions";

type Recipe = {
  id: string;
  title: string;
  cuisine: string | null;
  tags: string | null;
  description: string | null;
  ingredientsText: string | null;
  instructionsText: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  imageUrl: string | null;
  starred: boolean;
};

type ProposalRecipeItem = {
  id: string;
  recipeId: string;
  courseLabel: string | null;
  recipe: {
    title: string;
    description: string | null;
    ingredientsText: string | null;
    instructionsText: string | null;
    prepMinutes: number | null;
    cookMinutes: number | null;
    servings: number | null;
    cuisine: string | null;
    imageUrl: string | null;
  };
};

const COURSE_CATEGORIES = [
  "Healthy Juice",
  "Smoothie",
  "Breakfast",
  "Morning Nourishment",
  "Snack",
  "Salad",
  "Soup",
  "Entrees",
  "Side",
  "Dessert",
  "A Gift from Beth",
];

type ProposalRecipeManagerProps = {
  proposalId: string;
  currentRecipes: ProposalRecipeItem[];
  allRecipes: Recipe[];
};

function RecipeAccordion({
  title,
  description,
  ingredientsText,
  instructionsText,
  prepMinutes,
  cookMinutes,
  servings,
  cuisine,
  imageUrl,
  isOpen,
  onToggle,
}: {
  title: string;
  description: string | null;
  ingredientsText: string | null;
  instructionsText: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  cuisine: string | null;
  imageUrl: string | null;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs space-y-2">
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={title}
          width={300}
          height={150}
          className="w-full h-32 rounded-lg object-cover"
        />
      )}

      {description && (
        <div className="space-y-1.5">
          {description
            .replace(/\.\s+([A-Z])/g, ".\n$1")
            .split("\n")
            .filter(Boolean)
            .map((para, i) => (
              <p key={i} className="text-slate-600 leading-relaxed">{para.trim()}</p>
            ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-slate-400">
        {cuisine && <span>{cuisine}</span>}
        {prepMinutes && <span>{prepMinutes}m prep</span>}
        {cookMinutes && <span>{cookMinutes}m cook</span>}
        {servings && <span>Serves {servings}</span>}
      </div>

      {ingredientsText && (
        <div>
          <p className="font-semibold text-slate-500 mb-1">Ingredients</p>
          <p className="text-slate-600 whitespace-pre-line leading-relaxed">
            {ingredientsText}
          </p>
        </div>
      )}

      {instructionsText && (
        <div>
          <p className="font-semibold text-slate-500 mb-1">Instructions</p>
          <p className="text-slate-600 whitespace-pre-line leading-relaxed">
            {instructionsText}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="text-[11px] text-slate-400 hover:text-slate-600"
      >
        Collapse
      </button>
    </div>
  );
}

export function ProposalRecipeManager({
  proposalId,
  currentRecipes,
  allRecipes,
}: ProposalRecipeManagerProps) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [showStarred, setShowStarred] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteExpanded, setPasteExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const [justRemoved, setJustRemoved] = useState<Set<string>>(new Set());
  const [dropOver, setDropOver] = useState(false);
  const [openLeft, setOpenLeft] = useState<Set<string>>(new Set());
  const [openRight, setOpenRight] = useState<Set<string>>(new Set());

  const currentRecipeIds = new Set(currentRecipes.map((r) => r.recipeId));
  const visibleCurrentRecipes = currentRecipes.filter(
    (r) => !justRemoved.has(r.id),
  );

  // Build tag list for filters
  const tagCounts = new Map<string, number>();
  for (const r of allRecipes) {
    if (r.tags) {
      for (const t of r.tags.split(",").map(s => s.trim()).filter(Boolean)) {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  const filtered = allRecipes.filter((r) => {
    if (showStarred && !r.starred) return false;
    if (activeTag && !(r.tags?.toLowerCase().includes(activeTag.toLowerCase()))) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        (r.cuisine && r.cuisine.toLowerCase().includes(q)) ||
        (r.tags && r.tags.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q))
        );
    }
    return true;
  });

  const available = filtered.filter(
    (r) => !currentRecipeIds.has(r.id) && !justAdded.has(r.id),
  );

  function handleAdd(recipeId: string) {
    const formData = new FormData();
    formData.set("proposalId", proposalId);
    formData.set("recipeId", recipeId);
    startTransition(async () => {
      await addRecipeToProposal(formData);
      setJustAdded((prev) => new Set(prev).add(recipeId));
    });
  }

  function handleRemove(proposalRecipeId: string) {
    const formData = new FormData();
    formData.set("proposalRecipeId", proposalRecipeId);
    startTransition(async () => {
      await removeRecipeFromProposal(formData);
      setJustRemoved((prev) => new Set(prev).add(proposalRecipeId));
    });
  }

  async function handlePaste() {
    if (!pasteText.trim()) return;
    setPasteBusy(true);
    try {
      const res = await fetch("/api/proposals/paste-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, text: pasteText }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(`Failed: ${data.error || "Unknown error"}`);
        setPasteBusy(false);
      }
    } catch {
      alert("Failed to parse menu");
      setPasteBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropOver(false);
    const recipeId = e.dataTransfer.getData("text/recipe-id");
    if (recipeId && !currentRecipeIds.has(recipeId) && !justAdded.has(recipeId)) {
      handleAdd(recipeId);
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4 xl:h-[calc(100vh-320px)]">
      {/* ===== LEFT: Current menu ===== */}
      <div
        className={`rounded-xl border-2 border-dashed p-4 transition-all min-h-64 xl:overflow-y-auto ${
          dropOver
            ? "border-[var(--accent)] bg-[var(--accent-light)]"
            : "border-slate-200 bg-slate-50/50"
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDropOver(true); }}
        onDragLeave={() => setDropOver(false)}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Menu ({visibleCurrentRecipes.length})
          </p>
          {dropOver && (
            <p className="text-xs font-medium text-[var(--accent)]">Drop to add</p>
          )}
        </div>

        {visibleCurrentRecipes.length > 0 ? (
          <div className="space-y-1">
            {(() => {
              let lastCategory: string | null = null;
              return visibleCurrentRecipes.map((item, index) => {
                const showHeader = item.courseLabel !== lastCategory && item.courseLabel;
                lastCategory = item.courseLabel;
                return (
                  <div key={item.id}>
                    {showHeader && (
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-3 mb-1 first:mt-0">
                        {item.courseLabel}
                      </div>
                    )}
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => setOpenLeft(prev => { const next = new Set(prev); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })}
                          className="text-left text-sm font-medium text-slate-700 truncate hover:text-[var(--accent)] block w-full"
                        >
                          {item.recipe.title}
                        </button>
                        <select
                          className="mt-0.5 w-full rounded border-0 bg-transparent px-0 py-0 text-[10px] text-slate-400 focus:ring-0 cursor-pointer"
                          defaultValue={item.courseLabel || ""}
                          onChange={(e) => {
                            const fd = new FormData();
                            fd.set("proposalRecipeId", item.id);
                            fd.set("courseLabel", e.target.value);
                            startTransition(() => updateProposalRecipeCategory(fd));
                          }}
                        >
                          <option value="">No category</option>
                          {COURSE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                  <button
                    type="button"
                    onClick={() => setOpenLeft(prev => { const next = new Set(prev); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })}
                    className="shrink-0 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${openLeft.has(item.id) ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemove(item.id)}
                    className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                    title="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <RecipeAccordion
                  {...item.recipe}
                  isOpen={openLeft.has(item.id)}
                  onToggle={() => setOpenLeft(prev => { const next = new Set(prev); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next; })}
                />
              </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <svg className="h-8 w-8 text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-sm text-slate-400">Drag recipes here or click + to add</p>
          </div>
        )}
      </div>

      {/* ===== RIGHT: Recipe search ===== */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 xl:overflow-y-auto">
        {/* Paste menu — purple-bordered section */}
        <div className="rounded-lg border-2 border-dashed border-purple-200 bg-purple-50/40 p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">
                Paste menu
              </p>
            </div>
            {pasteText.length > 0 && (
              <button
                type="button"
                onClick={() => { setPasteText(""); setPasteExpanded(false); }}
                className="text-[10px] text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            className="w-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-purple-300"
            rows={pasteExpanded ? 10 : 3}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onFocus={() => setPasteExpanded(true)}
            placeholder="Paste freeform menu text — category headers and recipes get parsed by AI..."
          />
          {pasteExpanded && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handlePaste}
                disabled={!pasteText.trim() || pasteBusy}
                className="rounded-md bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {pasteBusy ? "Parsing..." : "Parse & add to menu"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Find recipes ({available.length})
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowStarred(!showStarred)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                showStarred
                  ? "bg-amber-50 text-amber-600 ring-1 ring-amber-200"
                  : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-500"
              }`}
            >
              ★ Starred
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                showFilters || activeTag
                  ? "bg-[var(--accent-light)] text-[var(--accent)]"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              Tags {activeTag && `· ${activeTag}`}
            </button>
          </div>
        </div>

        {showFilters && topTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            <button
              type="button"
              onClick={() => setActiveTag("")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                !activeTag ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            {topTags.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                  activeTag === tag
                    ? "bg-[var(--accent)] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tag} ({count})
              </button>
            ))}
          </div>
        )}

        <input
          type="search"
          placeholder="Search by title, cuisine, or tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="field mb-3"
        />
        <div className="space-y-1 -mx-1 px-1">
          {available.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-6">
              {search ? "No matching recipes" : "All recipes are in the menu"}
            </p>
          ) : (
            available.map((recipe) => (
              <div key={recipe.id}>
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/recipe-id", recipe.id);
                    e.dataTransfer.setData("text/plain", recipe.title);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 cursor-grab active:cursor-grabbing hover:border-slate-200 hover:bg-slate-50 transition-colors group"
                >
                  <svg className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="5" r="1.5" />
                    <circle cx="15" cy="5" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="19" r="1.5" />
                    <circle cx="15" cy="19" r="1.5" />
                  </svg>

                  <button
                    type="button"
                    onClick={() => setOpenRight(prev => { const next = new Set(prev); next.has(recipe.id) ? next.delete(recipe.id) : next.add(recipe.id); return next; })}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {recipe.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {[recipe.cuisine, recipe.tags].filter(Boolean).join(" · ") || "No tags"}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenRight(prev => { const next = new Set(prev); next.has(recipe.id) ? next.delete(recipe.id) : next.add(recipe.id); return next; })}
                    className="shrink-0 p-1 text-slate-400 hover:text-slate-600"
                  >
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${openRight.has(recipe.id) ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleAdd(recipe.id)}
                    className="shrink-0 rounded-md bg-[var(--accent)] p-1 text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 xl:hidden"
                    title="Add to menu"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                </div>

                <RecipeAccordion
                  title={recipe.title}
                  description={recipe.description}
                  ingredientsText={recipe.ingredientsText}
                  instructionsText={recipe.instructionsText}
                  prepMinutes={recipe.prepMinutes}
                  cookMinutes={recipe.cookMinutes}
                  servings={recipe.servings}
                  cuisine={recipe.cuisine}
                  imageUrl={recipe.imageUrl}
                  isOpen={openRight.has(recipe.id)}
                  onToggle={() => setOpenRight(prev => { const next = new Set(prev); next.has(recipe.id) ? next.delete(recipe.id) : next.add(recipe.id); return next; })}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
