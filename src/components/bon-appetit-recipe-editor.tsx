"use client";

import { useState } from "react";

interface RecipeOption {
  id: string;
  title: string;
  cuisine: string | null;
  description: string | null;
}

interface RecipeEntry {
  mode: "existing" | "custom";
  recipeId: string;
  title: string;
  description: string;
  category: string;
}

const DEFAULT_CATEGORIES = [
  "Morning Nourishment",
  "Entrees and Sides",
  "Soups and Salads",
  "Snacks and Small Plates",
  "Desserts",
];

/**
 * Parse pasted text block into recipe entries.
 * Expects format:
 *   Category Name
 *   Recipe Title
 *   Recipe description...
 *   (blank line)
 *   Recipe Title
 *   Description...
 */
function parsePastedRecipes(text: string): RecipeEntry[] {
  const entries: RecipeEntry[] = [];
  const lines = text.split("\n").map((l) => l.trim());

  let currentCategory = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (!line) {
      i++;
      continue;
    }

    // Check if this line is a category header (matches known categories or is short + no period)
    const isCategory =
      DEFAULT_CATEGORIES.some(
        (c) => c.toLowerCase() === line.toLowerCase(),
      ) ||
      (line.length < 40 && !line.includes(".") && !line.includes(",") && i + 1 < lines.length);

    if (isCategory && DEFAULT_CATEGORIES.some((c) => c.toLowerCase() === line.toLowerCase())) {
      currentCategory = DEFAULT_CATEGORIES.find(
        (c) => c.toLowerCase() === line.toLowerCase(),
      )!;
      i++;
      continue;
    }

    // This line is a recipe title — collect description lines after it
    const title = line;
    const descLines: string[] = [];
    i++;

    while (i < lines.length && lines[i] && !DEFAULT_CATEGORIES.some((c) => c.toLowerCase() === lines[i].toLowerCase())) {
      descLines.push(lines[i]);
      i++;
    }

    entries.push({
      mode: "custom",
      recipeId: "",
      title,
      description: descLines.join(" "),
      category: currentCategory,
    });
  }

  return entries;
}

export function BonAppetitRecipeEditor({
  recipes,
}: {
  recipes: RecipeOption[];
}) {
  const [entries, setEntries] = useState<RecipeEntry[]>([]);
  const [search, setSearch] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");

  // Search existing recipes
  const filtered = recipes.filter(
    (r) =>
      !entries.some((e) => e.recipeId === r.id) &&
      search.length > 0 &&
      (r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.cuisine?.toLowerCase().includes(search.toLowerCase())),
  );

  function addExisting(recipe: RecipeOption) {
    setEntries([
      ...entries,
      {
        mode: "existing",
        recipeId: recipe.id,
        title: recipe.title,
        description: recipe.description || "",
        category: "",
      },
    ]);
    setSearch("");
  }

  function addCustom() {
    setEntries([
      ...entries,
      { mode: "custom", recipeId: "", title: "", description: "", category: "" },
    ]);
  }

  function handlePaste() {
    const parsed = parsePastedRecipes(pasteText);
    if (parsed.length > 0) {
      setEntries([...entries, ...parsed]);
      setPasteText("");
      setPasteMode(false);
    }
  }

  function removeEntry(index: number) {
    setEntries(entries.filter((_, i) => i !== index));
  }

  function updateEntry(index: number, field: keyof RecipeEntry, value: string) {
    setEntries(
      entries.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...entries];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setEntries(next);
  }

  function moveDown(index: number) {
    if (index === entries.length - 1) return;
    const next = [...entries];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setEntries(next);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-slate-700">
          Recipes
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPasteMode(!pasteMode)}
            className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            {pasteMode ? "Cancel paste" : "Paste recipes"}
          </button>
          <button
            type="button"
            onClick={addCustom}
            className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            + Add manually
          </button>
        </div>
      </div>

      {/* Paste mode */}
      {pasteMode && (
        <div className="mb-3 rounded-lg border border-dashed border-[var(--accent)] bg-[var(--accent-light)] p-3">
          <p className="text-xs text-slate-600 mb-2">
            Paste your recipe list. Use category names on their own line (e.g.
            &quot;Morning Nourishment&quot;, &quot;Entrees and Sides&quot;), then recipe title
            followed by description.
          </p>
          <textarea
            className="field min-h-40 text-sm"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Morning Nourishment\nGreen Goddess Chicken Salad...\nA vibrant, herb-packed...\n\nEntrees and Sides\nMediterranean Baked Chicken...\nThis vibrant dish..."}
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={!pasteText.trim()}
            className="button-primary mt-2 text-sm w-full disabled:opacity-50"
          >
            Parse &amp; add recipes
          </button>
        </div>
      )}

      {/* Entries list */}
      {entries.length > 0 && (
        <div className="space-y-2 mb-3">
          {entries.map((entry, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              {/* Hidden fields for form submission */}
              {entry.mode === "existing" && (
                <input type="hidden" name="recipeId" value={entry.recipeId} />
              )}
              {entry.mode === "custom" && (
                <>
                  <input type="hidden" name="recipeId" value="" />
                  <input type="hidden" name="customTitle" value={entry.title} />
                  <input
                    type="hidden"
                    name="customDescription"
                    value={entry.description}
                  />
                </>
              )}
              <input type="hidden" name="recipeCategory" value={entry.category} />

              <div className="flex items-start gap-2">
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5 mt-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === entries.length - 1}
                    className="text-slate-400 hover:text-slate-600 disabled:opacity-30"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  {entry.mode === "existing" ? (
                    <p className="text-sm font-medium text-slate-900">
                      {entry.title}
                      <span className="ml-1.5 text-xs text-slate-400">
                        (from library)
                      </span>
                    </p>
                  ) : (
                    <>
                      <input
                        className="field text-sm font-medium"
                        placeholder="Recipe title"
                        value={entry.title}
                        onChange={(e) =>
                          updateEntry(index, "title", e.target.value)
                        }
                      />
                      <textarea
                        className="field text-xs min-h-14"
                        placeholder="Description"
                        value={entry.description}
                        onChange={(e) =>
                          updateEntry(index, "description", e.target.value)
                        }
                      />
                    </>
                  )}
                  <select
                    value={entry.category}
                    onChange={(e) =>
                      updateEntry(index, "category", e.target.value)
                    }
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                  >
                    <option value="">No category</option>
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => removeEntry(index)}
                  className="text-slate-400 hover:text-red-500 shrink-0 mt-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search existing recipes */}
      <div className="relative">
        <input
          className="field text-sm"
          type="text"
          placeholder="Search existing recipes to add..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {filtered.slice(0, 8).map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => addExisting(recipe)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">
                  {recipe.title}
                </span>
                {recipe.cuisine && (
                  <span className="ml-2 text-xs text-slate-500">
                    {recipe.cuisine}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {entries.length} recipe{entries.length !== 1 ? "s" : ""} added
      </p>
    </div>
  );
}
