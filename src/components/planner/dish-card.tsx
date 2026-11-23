"use client";

import { OTHER_SLOT, type PlannerDish, type RecipeHit } from "./planner-logic";
import { CARD, FOCUS, ICON_BTN } from "./ui";

export type SwapState =
  | { status: "loading" }
  | { status: "ready"; options: RecipeHit[] }
  | { status: "error"; message: string };

function Badge({ tone, children }: { tone: "green" | "stone" | "rose" | "amber"; children: React.ReactNode }) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700"
        : tone === "amber"
          ? "bg-amber-100 text-amber-900"
          : "bg-stone-100 text-stone-600";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function DishCard({
  dish,
  slot,
  slots,
  editable,
  pending,
  swap,
  onSwap,
  onPickSwap,
  onCloseSwap,
  onRemove,
  onCategory,
}: {
  dish: PlannerDish;
  /** The slot this dish is shown under. */
  slot: string;
  slots: string[];
  editable: boolean;
  /** Still being saved (temporary id): swap/remove wait for the real row. */
  pending: boolean;
  swap: SwapState | null;
  onSwap: () => void;
  onPickSwap: (hit: RecipeHit) => void;
  onCloseSwap: () => void;
  onRemove: () => void;
  onCategory: (value: string | null) => void;
}) {
  // Keep a legacy label (e.g. "A Gift from Beth") selectable as itself.
  const legacy = slot === OTHER_SLOT && dish.courseLabel && !slots.includes(dish.courseLabel) ? dish.courseLabel : null;
  const selectValue = slot === OTHER_SLOT ? (legacy ?? "") : slot;
  const selectId = `course-${dish.id}`;

  return (
    <li className={`${CARD} px-4 py-3 ${dish.clientRemoved ? "border-rose-200" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-semibold leading-snug text-stone-900 ${dish.clientRemoved ? "line-through decoration-rose-400" : ""}`}>
            {dish.title}
          </p>
          {dish.description && <p className="mt-0.5 truncate text-sm text-stone-500">{dish.description}</p>}
          {(dish.keptLastTime || dish.servedLabel || dish.clientRemoved || dish.conflict) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {dish.conflict && <Badge tone="amber">Contains {dish.conflict}</Badge>}
              {dish.clientRemoved && <Badge tone="rose">Client skipped this</Badge>}
              {dish.keptLastTime && <Badge tone="green">Kept last time</Badge>}
              {dish.servedLabel && <Badge tone="stone">Served {dish.servedLabel}</Badge>}
            </div>
          )}
        </div>

        {editable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={swap ? onCloseSwap : onSwap}
              disabled={pending}
              aria-expanded={!!swap}
              aria-label={`Swap ${dish.title}`}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40 sm:min-h-9 ${FOCUS}`}
            >
              Swap
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              aria-label={`Remove ${dish.title}`}
              className={`${ICON_BTN} hover:bg-rose-50 hover:text-rose-600`}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {editable && (
        <div className="mt-2 flex items-center gap-2">
          <label htmlFor={selectId} className="text-xs text-stone-500">
            Course
          </label>
          <select
            id={selectId}
            value={selectValue}
            disabled={pending}
            onChange={(e) => onCategory(e.target.value || null)}
            className={`h-11 rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-700 sm:h-8 ${FOCUS}`}
          >
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {legacy && <option value={legacy}>{legacy}</option>}
            <option value="">{OTHER_SLOT}</option>
          </select>
          {pending && <span className="text-xs text-stone-400">Saving…</span>}
        </div>
      )}

      {swap && (
        <div className="mt-3 rounded-xl bg-stone-50 p-3" aria-live="polite">
          {swap.status === "loading" && <p className="text-xs text-stone-500">Finding safe alternatives…</p>}
          {swap.status === "error" && <p className="text-xs text-rose-700">{swap.message}</p>}
          {swap.status === "ready" && swap.options.length === 0 && (
            <p className="text-xs text-stone-500">No other safe, fresh {slot.toLowerCase()} to swap in right now. Try the finder.</p>
          )}
          {swap.status === "ready" && swap.options.length > 0 && (
            <>
              <p className="text-xs font-medium text-stone-500">Swap for</p>
              <ul className="mt-1.5 space-y-1.5">
                {swap.options.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => onPickSwap(hit)}
                      className={`block min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left transition hover:border-[var(--accent)] ${FOCUS}`}
                    >
                      <span className="block truncate text-sm font-medium text-stone-900">{hit.title}</span>
                      {hit.description && <span className="block truncate text-xs text-stone-500">{hit.description}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={onCloseSwap}
            className={`mt-2 min-h-11 rounded-lg px-2 text-xs font-medium text-stone-500 hover:text-stone-800 sm:min-h-8 ${FOCUS}`}
          >
            Keep {dish.title}
          </button>
        </div>
      )}
    </li>
  );
}
