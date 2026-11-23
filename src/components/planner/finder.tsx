"use client";

import { useRef, useState, type RefObject } from "react";
import { searchRecipesForPlanner } from "@/app/planner-actions";
import type { PlannerFilters, RecipeHit } from "./planner-logic";
import { FOCUS } from "./ui";

const DEFAULT_FILTERS: PlannerFilters = { safeOnly: true, notRecent: true, category: null };

/** Finder state lives here; every search runs from an event handler. */
export function useFinder(proposalId: string, initialResults: RecipeHit[]) {
  const [query, setQueryState] = useState("");
  const [filters, setFilters] = useState<PlannerFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<RecipeHit[]>(initialResults);
  const [hidden, setHidden] = useState<RecipeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function run(q: string, f: PlannerFilters) {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await searchRecipesForPlanner(proposalId, q, f);
      if (mine !== seq.current) return;
      if (res.ok) {
        setResults(res.results);
        setHidden(res.hidden);
        setError(null);
      } else {
        setError(res.error);
      }
    } catch {
      if (mine === seq.current) setError("Search isn't responding. Try again in a moment.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }

  function setQuery(q: string) {
    setQueryState(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(q, filters), 180);
  }

  function updateFilters(next: Partial<PlannerFilters>) {
    const merged = { ...filters, ...next };
    setFilters(merged);
    if (timer.current) clearTimeout(timer.current);
    void run(query, merged);
  }

  return {
    query,
    filters,
    results,
    hidden,
    loading,
    error,
    setQuery,
    setCategory: (category: string | null) => updateFilters({ category }),
    toggleSafe: () => updateFilters({ safeOnly: !filters.safeOnly }),
    toggleRecent: () => updateFilters({ notRecent: !filters.notRecent }),
    refresh: () => run(query, filters),
  };
}

export type FinderState = ReturnType<typeof useFinder>;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-medium transition sm:min-h-8 ${FOCUS} ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent-strong)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {active && (
        <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
        </svg>
      )}
      {children}
    </button>
  );
}

function hiddenReason(hit: RecipeHit, filters: PlannerFilters): string {
  if (filters.safeOnly && hit.conflict) return `Hidden for this client: contains ${hit.conflict}`;
  return `Served ${hit.lastServedLabel ?? "recently"} — hidden by “Not served in 4 weeks”`;
}

export function Finder({
  finder,
  firstName,
  slots,
  onMenu,
  onAdd,
  inputRef,
  onClose,
  paste,
  drag,
}: {
  finder: FinderState;
  firstName: string;
  slots: string[];
  onMenu: Set<string>;
  onAdd: (hit: RecipeHit) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  paste: React.ReactNode;
  /** Desktop only: drag a result onto the menu. */
  drag?: {
    onDragStart: (e: React.DragEvent<HTMLElement>, hit: RecipeHit) => void;
    onDragEnd: (e: React.DragEvent<HTMLElement>) => void;
  };
}) {
  const visible = finder.results.filter((r) => !onMenu.has(r.id));
  const hidden = finder.hidden.filter((r) => !onMenu.has(r.id));
  const searching = finder.query.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {finder.filters.category ? `Find ${finder.filters.category.toLowerCase()}` : "Recipes"}
          </h2>
          {drag && <p className="text-xs text-slate-500">Drag a recipe onto the menu, or tap +.</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 md:hidden ${FOCUS}`}
        >
          Done
        </button>
      </div>

      <label htmlFor="planner-search" className="sr-only">
        Search recipes
      </label>
      <div className="relative mt-3">
        <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
        <input
          id="planner-search"
          ref={inputRef}
          type="search"
          autoComplete="off"
          value={finder.query}
          onChange={(e) => finder.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (visible[0]) {
                onAdd(visible[0]);
                finder.setQuery(""); // so a second Enter doesn't add the next match
              }
            }
          }}
          placeholder="Search title, ingredient, tag…"
          className={`h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--accent)] ${FOCUS}`}
        />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">Enter adds the top result.</p>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filters">
        <Chip active={finder.filters.safeOnly} onClick={finder.toggleSafe}>
          Safe for {firstName}
        </Chip>
        <Chip active={finder.filters.notRecent} onClick={finder.toggleRecent}>
          Not served in 4 weeks
        </Chip>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Course">
        {slots.map((slot) => (
          <Chip
            key={slot}
            active={finder.filters.category === slot}
            onClick={() => finder.setCategory(finder.filters.category === slot ? null : slot)}
          >
            {slot}
          </Chip>
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto md:max-h-[calc(100vh-22rem)]" aria-busy={finder.loading}>
        <p className="sr-only" aria-live="polite">
          {finder.loading ? "Searching" : `${visible.length} results`}
        </p>
        {finder.error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {finder.error}{" "}
            <button type="button" onClick={() => finder.refresh()} className={`font-semibold underline ${FOCUS}`}>
              Retry
            </button>
          </p>
        )}
        <ul className={`space-y-1.5 transition-opacity ${finder.loading ? "opacity-60" : ""}`}>
          {visible.map((hit, i) => (
            <li
              key={hit.id}
              draggable={!!drag}
              onDragStart={drag ? (e) => drag.onDragStart(e, hit) : undefined}
              onDragEnd={drag?.onDragEnd}
              className={drag ? "cursor-grab active:cursor-grabbing" : undefined}
            >
              <div className={`group/hit flex items-start gap-2 rounded-xl border py-2 pr-3 transition hover:border-[var(--accent)] ${drag ? "pl-1.5" : "pl-3"} ${i === 0 && searching ? "border-[var(--accent)] bg-[var(--accent-light)]/40" : "border-slate-200 bg-white"}`}>
                {drag && (
                  <svg
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-slate-300 transition group-hover/hit:text-slate-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M7 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-1.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-1.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 16a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                  </svg>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug text-slate-900">
                    {hit.starred && (
                      <span aria-label="Starred" className="mr-1 text-amber-500">
                        ★
                      </span>
                    )}
                    {hit.title}
                  </p>
                  {hit.description && <p className="mt-0.5 text-xs leading-snug text-slate-500">{hit.description}</p>}
                  {(hit.lastServedLabel || hit.timesKept > 1) && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {hit.lastServedLabel && <>Served to {firstName} {hit.lastServedLabel}</>}
                      {hit.lastServedLabel && hit.timesKept > 1 && " · "}
                      {hit.timesKept > 1 && <>Kept {hit.timesKept}×</>}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(hit)}
                  aria-label={`Add ${hit.title}`}
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full text-[var(--accent-strong)] opacity-60 transition hover:bg-[var(--accent-light)] hover:opacity-100 group-hover/hit:opacity-100 sm:h-9 sm:w-9 ${FOCUS}`}
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>

        {!finder.loading && visible.length === 0 && !finder.error && (
          <p className="py-6 text-center text-sm text-slate-500">
            {searching
              ? "No matches."
              : finder.filters.category
                ? `No more ${finder.filters.category.toLowerCase()} that fit these filters.`
                : "Nothing left that fits these filters."}
          </p>
        )}

        {searching && hidden.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500">Hidden by filters</p>
            <ul className="mt-1.5 space-y-1.5">
              {hidden.map((hit) => (
                <li key={hit.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-slate-600">{hit.title}</p>
                    <p className={`text-xs ${hit.conflict && finder.filters.safeOnly ? "text-amber-700" : "text-slate-500"}`}>
                      {hiddenReason(hit, finder.filters)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdd(hit)}
                    aria-label={`Add ${hit.title} anyway`}
                    className={`min-h-11 shrink-0 rounded-lg px-2 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline sm:min-h-8 ${FOCUS}`}
                  >
                    Add anyway
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">{paste}</div>
    </div>
  );
}
