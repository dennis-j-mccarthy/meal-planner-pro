"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  createManualRecipe,
  createRecipeFromPhoto,
  queueAiRecipe,
  queueUrlRecipe,
  importEdamamRecipe,
} from "@/app/actions";

type Tab = "discover" | "search" | "url" | "ai" | "manual" | "photo";

// Downscale a recipe photo before sending it to the server action: keeps it
// under the body-size limit while preserving enough resolution for OCR.
const OCR_MAX_DIM = 1600;
const OCR_QUALITY = 0.85;

async function resizeForOcr(file: File): Promise<File> {
  if (file.type === "image/svg+xml") return file;

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // `Image` is shadowed by the next/image import; use the DOM constructor.
  const img = new window.Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });

  const longest = Math.max(img.width, img.height);
  if (longest <= OCR_MAX_DIM && file.size < 900_000) return file;

  const ratio = Math.min(1, OCR_MAX_DIM / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * ratio);
  canvas.height = Math.round(img.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      OCR_QUALITY,
    ),
  );
  return new File([blob], "recipe-photo.jpg", { type: "image/jpeg" });
}

const HEALTH_FILTERS = [
  "gluten-free",
  "dairy-free",
  "egg-free",
  "peanut-free",
  "tree-nut-free",
  "soy-free",
  "fish-free",
  "shellfish-free",
  "vegan",
  "vegetarian",
  "paleo",
  "keto-friendly",
  "Mediterranean",
  "pescatarian",
  "low-sugar",
  "sugar-conscious",
  "alcohol-free",
  "pork-free",
];

const DIET_FILTERS = [
  "balanced",
  "high-protein",
  "high-fiber",
  "low-carb",
  "low-fat",
  "low-sodium",
];

interface EdamamRecipe {
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
}

export function AddRecipeModal() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("discover");
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Edamam search state
  const [searchQuery, setSearchQuery] = useState("");
  const [healthFilters, setHealthFilters] = useState<string[]>([]);
  const [dietFilters, setDietFilters] = useState<string[]>([]);
  const [results, setResults] = useState<EdamamRecipe[]>([]);
  const [searching, setSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Discover state
  const [discoverResults, setDiscoverResults] = useState<EdamamRecipe[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [importingIds, setImportingIds] = useState<Set<string>>(new Set());

  // Photo-import state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  function pickPhoto(file: File) {
    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  // Paste a screenshot/photo straight into the modal while the photo tab is open.
  useEffect(() => {
    if (!open || tab !== "photo") return;
    function onPaste(e: ClipboardEvent) {
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        e.preventDefault();
        pickPhoto(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, tab]);

  async function handlePhotoSubmit() {
    if (!photoFile) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const resized = await resizeForOcr(photoFile);
      const fd = new FormData();
      fd.set("photo", resized);
      // Server action extracts the recipe and redirects to the new page.
      await createRecipeFromPhoto(fd);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Couldn't read that photo. Try another image.",
      );
      setPhotoBusy(false);
    }
  }

  function toggleHealth(label: string) {
    setHealthFilters((prev) =>
      prev.includes(label) ? prev.filter((h) => h !== label) : [...prev, label],
    );
  }

  function toggleDiet(label: string) {
    setDietFilters((prev) =>
      prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label],
    );
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("q", searchQuery);
      for (const h of healthFilters) params.append("health", h);
      for (const d of dietFilters) params.append("diet", d);
      const res = await fetch(`/api/recipes/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.recipes || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  const DISCOVER_CATEGORIES = [
    { label: "Healthy Chicken", query: "healthy chicken", health: ["gluten-free"] },
    { label: "Mediterranean", query: "Mediterranean", health: ["Mediterranean"] },
    { label: "Anti-Inflammatory", query: "turmeric ginger salmon", health: ["gluten-free", "dairy-free"] },
    { label: "High Protein", query: "high protein meal", diet: ["high-protein"] },
    { label: "Plant-Based", query: "vegetable grain bowl", health: ["vegan"] },
    { label: "Seafood", query: "grilled fish seafood", health: ["pescatarian"] },
    { label: "Low Carb", query: "low carb dinner", diet: ["low-carb"] },
    { label: "Whole30 / Paleo", query: "paleo dinner", health: ["paleo"] },
    { label: "Soups & Stews", query: "healthy soup stew" },
    { label: "Salads", query: "hearty salad protein" },
    { label: "Breakfast", query: "healthy breakfast" },
    { label: "Smoothie Bowls", query: "smoothie bowl acai" },
  ];

  async function loadCategory(cat: typeof DISCOVER_CATEGORIES[number]) {
    setActiveCategory(cat.label);
    setDiscoverLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("q", cat.query);
      if (cat.health) for (const h of cat.health) params.append("health", h);
      if (cat.diet) for (const d of cat.diet) params.append("diet", d);
      const res = await fetch(`/api/recipes/search?${params.toString()}`);
      const data = await res.json();
      setDiscoverResults(data.recipes || []);
    } catch {
      setDiscoverResults([]);
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function handleBulkImport() {
    const toImport = discoverResults.filter((r) => !importingIds.has(r.uri));
    for (const recipe of toImport) {
      setImportingIds((prev) => new Set([...prev, recipe.uri]));
      const fd = new FormData();
      fd.set("title", recipe.label);
      fd.set("sourceUrl", recipe.url);
      fd.set("imageUrl", recipe.image);
      fd.set("ingredients", recipe.ingredientLines.join("\n"));
      fd.set("cuisine", recipe.cuisineType[0] || "");
      fd.set("servings", String(recipe.yield || ""));
      fd.set("totalTime", String(recipe.totalTime || ""));
      fd.set("healthLabels", recipe.healthLabels.slice(0, 8).join(", "));
      fd.set("source", recipe.source);
      try {
        await importEdamamRecipe(fd);
      } catch {
        // Continue with remaining
      }
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "discover", label: "Discover", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" },
    { key: "search", label: "Search", icon: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" },
    { key: "url", label: "From URL", icon: "M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" },
    { key: "photo", label: "From Photo", icon: "M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" },
    { key: "ai", label: "AI Assist", icon: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" },
    { key: "manual", label: "Manual", icon: "M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-primary text-sm gap-1"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add recipe
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-black/40 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Add a recipe</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-b-2 border-[var(--accent)] text-[var(--accent)]"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-130px)]">
          {/* ===== DISCOVER TAB ===== */}
          {tab === "discover" && (
            <div>
              <p className="text-sm text-slate-500 mb-3">
                Browse recipe collections. Click a category to load 20 recipes instantly.
              </p>

              {/* Category buttons */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {DISCOVER_CATEGORIES.map((cat) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => loadCategory(cat)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      activeCategory === cat.label
                        ? "bg-[var(--accent)] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {discoverLoading && (
                <p className="text-sm text-slate-500 text-center py-8">Loading recipes...</p>
              )}

              {!discoverLoading && discoverResults.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-slate-700">
                      {discoverResults.length} recipes
                    </p>
                    <button
                      type="button"
                      onClick={handleBulkImport}
                      className="button-primary text-xs px-3 py-1.5"
                    >
                      Import all {discoverResults.length}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {discoverResults.map((recipe) => (
                      <div
                        key={recipe.uri}
                        className="flex gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-colors"
                      >
                        {recipe.image && (
                          <Image
                            src={recipe.image}
                            alt={recipe.label}
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 truncate">
                            {recipe.label}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {recipe.source}
                            {recipe.totalTime > 0 && ` · ${recipe.totalTime} min`}
                            {recipe.yield > 0 && ` · ${recipe.yield} servings`}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {recipe.dietLabels.slice(0, 2).map((d) => (
                              <span key={d} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                {d}
                              </span>
                            ))}
                            {recipe.cuisineType.slice(0, 1).map((c) => (
                              <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                        <form action={importEdamamRecipe} className="shrink-0 self-center">
                          <input type="hidden" name="title" value={recipe.label} />
                          <input type="hidden" name="sourceUrl" value={recipe.url} />
                          <input type="hidden" name="imageUrl" value={recipe.image} />
                          <input type="hidden" name="ingredients" value={recipe.ingredientLines.join("\n")} />
                          <input type="hidden" name="cuisine" value={recipe.cuisineType[0] || ""} />
                          <input type="hidden" name="servings" value={String(recipe.yield || "")} />
                          <input type="hidden" name="totalTime" value={String(recipe.totalTime || "")} />
                          <input type="hidden" name="healthLabels" value={recipe.healthLabels.slice(0, 8).join(", ")} />
                          <input type="hidden" name="source" value={recipe.source} />
                          <button
                            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                              importingIds.has(recipe.uri)
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "button-primary"
                            }`}
                            disabled={importingIds.has(recipe.uri)}
                          >
                            {importingIds.has(recipe.uri) ? "Added" : "Import"}
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!discoverLoading && discoverResults.length === 0 && !activeCategory && (
                <div className="text-center py-8 text-sm text-slate-400">
                  Pick a category above to browse recipes
                </div>
              )}
            </div>
          )}

          {/* ===== SEARCH TAB ===== */}
          {tab === "search" && (
            <div>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  className="field flex-1"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search recipes... (e.g. grilled salmon, chicken stir fry)"
                />
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="button-primary text-sm shrink-0 disabled:opacity-50"
                >
                  {searching ? "..." : "Search"}
                </button>
              </form>

              {/* Filter toggle */}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="mt-2 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                {showFilters ? "Hide filters" : "Health & diet filters"}
                {(healthFilters.length > 0 || dietFilters.length > 0) &&
                  ` (${healthFilters.length + dietFilters.length} active)`}
              </button>

              {showFilters && (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Health
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {HEALTH_FILTERS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => toggleHealth(h)}
                          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            healthFilters.includes(h)
                              ? "bg-[var(--accent)] text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Diet
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {DIET_FILTERS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDiet(d)}
                          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            dietFilters.includes(d)
                              ? "bg-[var(--accent)] text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              <div className="mt-4 space-y-3">
                {results.length === 0 && !searching && searchQuery && (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No results. Try a different search or adjust filters.
                  </p>
                )}
                {results.map((recipe) => (
                  <div
                    key={recipe.uri}
                    className="flex gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-colors"
                  >
                    {recipe.image && (
                      <Image
                        src={recipe.image}
                        alt={recipe.label}
                        width={80}
                        height={80}
                        className="h-20 w-20 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {recipe.label}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {recipe.source}
                        {recipe.totalTime > 0 && ` · ${recipe.totalTime} min`}
                        {recipe.yield > 0 && ` · ${recipe.yield} servings`}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {recipe.dietLabels.slice(0, 3).map((d) => (
                          <span key={d} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            {d}
                          </span>
                        ))}
                        {recipe.cuisineType.slice(0, 2).map((c) => (
                          <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <form action={importEdamamRecipe} className="shrink-0 self-center">
                      <input type="hidden" name="title" value={recipe.label} />
                      <input type="hidden" name="sourceUrl" value={recipe.url} />
                      <input type="hidden" name="imageUrl" value={recipe.image} />
                      <input type="hidden" name="ingredients" value={recipe.ingredientLines.join("\n")} />
                      <input type="hidden" name="cuisine" value={recipe.cuisineType[0] || ""} />
                      <input type="hidden" name="servings" value={String(recipe.yield || "")} />
                      <input type="hidden" name="totalTime" value={String(recipe.totalTime || "")} />
                      <input type="hidden" name="healthLabels" value={recipe.healthLabels.slice(0, 8).join(", ")} />
                      <input type="hidden" name="source" value={recipe.source} />
                      <button className="button-primary text-xs px-3 py-1.5">
                        Import
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== URL TAB ===== */}
          {tab === "url" && (
            <form
              action={async (fd) => {
                await queueUrlRecipe(fd);
                setOpen(false);
              }}
            >
              <div className="grid gap-3">
                <input className="field" name="sourceUrl" placeholder="https://example.com/recipe" type="url" required />
                <input className="field" name="label" placeholder="Recipe name (auto-detected from page)" />
                <textarea className="field min-h-20" name="notes" placeholder="Parsing notes (optional)" />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="button-secondary text-sm">Cancel</button>
                <button type="submit" className="button-primary text-sm">Import from URL</button>
              </div>
            </form>
          )}

          {/* ===== PHOTO TAB ===== */}
          {tab === "photo" && (
            <div>
              <p className="text-sm text-slate-500 mb-3">
                Snap a cookbook page or upload a screenshot of a recipe — AI reads it and fills in the title, ingredients, and steps. You can edit everything afterward.
              </p>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) pickPhoto(file);
                }}
              />

              {!photoPreview ? (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-10 text-center hover:border-[var(--accent)] hover:bg-slate-50 transition-colors"
                >
                  <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700">
                    Take a photo or choose an image
                  </span>
                  <span className="text-xs text-slate-400">
                    or paste a screenshot with ⌘V
                  </span>
                </button>
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Recipe to import"
                    className="max-h-72 w-full rounded-xl object-contain border border-slate-200 bg-slate-50"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={photoBusy}
                      onClick={() => photoInputRef.current?.click()}
                      className="button-secondary text-sm disabled:opacity-50"
                    >
                      Choose another
                    </button>
                  </div>
                </div>
              )}

              {photoError && (
                <p className="mt-3 text-sm text-red-600">{photoError}</p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="button-secondary text-sm">Cancel</button>
                <button
                  type="button"
                  onClick={handlePhotoSubmit}
                  disabled={!photoFile || photoBusy}
                  className="button-primary text-sm disabled:opacity-50"
                >
                  {photoBusy ? "Reading recipe..." : "Extract recipe"}
                </button>
              </div>
            </div>
          )}

          {/* ===== AI TAB ===== */}
          {tab === "ai" && (
            <form
              action={async (fd) => {
                await queueAiRecipe(fd);
                setOpen(false);
              }}
            >
              <div className="grid gap-3">
                <input className="field" name="label" placeholder="Recipe name or theme" required />
                <textarea
                  className="field min-h-28"
                  name="prompt"
                  placeholder="Describe the recipe you want — style, dietary needs, ingredients to include or avoid, servings..."
                  required
                />
                <input className="field" name="notes" placeholder="Notes (optional)" />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="button-secondary text-sm">Cancel</button>
                <button type="submit" className="button-primary text-sm">Generate with AI</button>
              </div>
            </form>
          )}

          {/* ===== MANUAL TAB ===== */}
          {tab === "manual" && (
            <form
              action={async (fd) => {
                await createManualRecipe(fd);
                setOpen(false);
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <input className="field md:col-span-2" name="title" placeholder="Recipe title" required />
                <input className="field" name="cuisine" placeholder="Cuisine" />
                <input className="field" name="servings" placeholder="Servings" type="number" min="1" />
                <input className="field" name="prepMinutes" placeholder="Prep minutes" type="number" min="0" />
                <input className="field" name="cookMinutes" placeholder="Cook minutes" type="number" min="0" />
                <input className="field md:col-span-2" name="tags" placeholder="Tags: high-protein, family-style" />
                <input className="field md:col-span-2" name="dietaryFlags" placeholder="Dietary flags: gluten-free, dairy-free" />
                <textarea className="field md:col-span-2 min-h-24" name="description" placeholder="Recipe summary" />
                <textarea className="field md:col-span-2 min-h-20" name="ingredientsText" placeholder={"Ingredients, one per line"} />
                <textarea className="field md:col-span-2 min-h-24" name="instructionsText" placeholder={"Instructions, one step per line"} />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="button-secondary text-sm">Cancel</button>
                <button type="submit" className="button-primary text-sm">Save recipe</button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
