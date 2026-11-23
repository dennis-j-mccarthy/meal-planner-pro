"use client";

import { useRef, useState, type RefObject } from "react";
import { searchRecipesForPlanner } from "@/app/planner-actions";
import type { PlannerFilters, RecipeHit } from "./planner-logic";
import { BTN_PRIMARY, CARD, FOCUS } from "./ui";

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
          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
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
}: {
  finder: FinderState;
  firstName: string;
  slots: string[];
  onMenu: Set<string>;
  onAdd: (hit: RecipeHit) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  paste: React.ReactNode;
}) {
  const visible = finder.results.filter((r) => !onMenu.has(r.id));
  const hidden = finder.hidden.filter((r) => !onMenu.has(r.id));
  const searching = finder.query.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-stone-900">
          {finder.filters.category ? `Find ${finder.filters.category.toLowerCase()}` : "Find a dish"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-stone-500 hover:bg-stone-100 lg:hidden ${FOCUS}`}
        >
          Done
        </button>
      </div>

      <label htmlFor="planner-search" className="sr-only">
        Search recipes
      </label>
      <div className="relative mt-3">
        <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
          className={`h-11 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[var(--accent)] ${FOCUS}`}
        />
      </div>
      <p className="mt-1.5 text-xs text-stone-500">Enter adds the top result.</p>

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

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto lg:max-h-[calc(100vh-18rem)]" aria-busy={finder.loading}>
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
            <li key={hit.id}>
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${i === 0 && searching ? "border-[var(--accent)] bg-[var(--accent-light)]/40" : "border-stone-200 bg-white"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {hit.starred && (
                      <span aria-label="Starred" className="mr-1 text-amber-500">
                        ★
                      </span>
                    )}
                    {hit.title}
                  </p>
                  {hit.description && <p className="truncate text-xs text-stone-500">{hit.description}</p>}
                  {(hit.lastServedLabel || hit.timesKept > 1) && (
                    <p className="mt-0.5 text-xs text-stone-500">
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
                  className={`${BTN_PRIMARY} h-11 w-11 shrink-0 px-0 sm:h-9 sm:min-h-9 sm:w-9`}
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>

        {!finder.loading && visible.length === 0 && !finder.error && (
          <p className="py-6 text-center text-sm text-stone-500">
            {searching
              ? "No matches."
              : finder.filters.category
                ? `No more ${finder.filters.category.toLowerCase()} that fit these filters.`
                : "Nothing left that fits these filters."}
          </p>
        )}

        {searching && hidden.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-stone-500">Hidden by filters</p>
            <ul className="mt-1.5 space-y-1.5">
              {hidden.map((hit) => (
                <li key={hit.id} className={`${CARD} flex items-center gap-2 px-3 py-2 opacity-70`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-stone-600">{hit.title}</p>
                    <p className={`text-xs ${hit.conflict && finder.filters.safeOnly ? "text-amber-700" : "text-stone-500"}`}>
                      {hiddenReason(hit, finder.filters)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdd(hit)}
                    aria-label={`Add ${hit.title} anyway`}
                    className={`min-h-11 shrink-0 rounded-lg px-2 text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline sm:min-h-8 ${FOCUS}`}
                  >
                    Add anyway
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-stone-200 pt-3">{paste}</div>
    </div>
  );
}
