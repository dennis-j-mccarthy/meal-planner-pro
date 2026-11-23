"use client";

import { OTHER_SLOT, type PlannerDish, type RecipeHit } from "./planner-logic";
import { CARD, FOCUS, ICON_BTN } from "./ui";

export type SwapState =
  | { status: "loading" }
  | { status: "ready"; options: RecipeHit[] }
  | { status: "error"; message: string };

/** Desktop drag and drop wiring for one dish card (absent on phones). */
export type DishDrag = {
  onDragStart: (e: React.DragEvent<HTMLLIElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLLIElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLLIElement>) => void;
  onDrop: (e: React.DragEvent<HTMLLIElement>) => void;
  /** Show the insertion line above this card. */
  dropBefore: boolean;
  /** This card is the one being dragged. */
  dragging: boolean;
};

function Badge({ tone, children }: { tone: "green" | "slate" | "rose" | "amber"; children: React.ReactNode }) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700"
        : tone === "amber"
          ? "bg-amber-100 text-amber-900"
          : "bg-slate-100 text-slate-600";
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
  drag,
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
  drag?: DishDrag;
}) {
  // Keep a legacy label (e.g. "A Gift from Beth") selectable as itself.
  const legacy = slot === OTHER_SLOT && dish.courseLabel && !slots.includes(dish.courseLabel) ? dish.courseLabel : null;
  const selectValue = slot === OTHER_SLOT ? (legacy ?? "") : slot;
  const selectId = `course-${dish.id}`;

  return (
    <li
      className={`${CARD} relative px-4 py-3 ${dish.clientRemoved ? "border-rose-200" : ""} ${
        drag && !pending ? "cursor-grab active:cursor-grabbing" : ""
      } ${drag?.dragging ? "opacity-40" : ""}`}
      draggable={!!drag && !pending}
      onDragStart={drag?.onDragStart}
      onDragEnd={drag?.onDragEnd}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
    >
      {drag?.dropBefore && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-[7px] left-2 right-2 h-[3px] rounded-full bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent-light)]"
        />
      )}
      <div className="flex items-start gap-2">
        {drag && !pending && (
          <svg
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-slate-300"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M7 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-1.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-1.5 7.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 16a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
          </svg>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-semibold leading-snug text-slate-900 ${dish.clientRemoved ? "line-through decoration-rose-400" : ""}`}>
            {dish.title}
          </p>
          {dish.description && <p className="mt-0.5 truncate text-sm text-slate-500">{dish.description}</p>}
          {(dish.keptLastTime || dish.servedLabel || dish.clientRemoved || dish.conflict) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {dish.conflict && <Badge tone="amber">Contains {dish.conflict}</Badge>}
              {dish.clientRemoved && <Badge tone="rose">Client skipped this</Badge>}
              {dish.keptLastTime && <Badge tone="green">Kept last time</Badge>}
              {dish.servedLabel && <Badge tone="slate">Served {dish.servedLabel}</Badge>}
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
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 sm:min-h-9 ${FOCUS}`}
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
          <label htmlFor={selectId} className="text-xs text-slate-500">
            Course
          </label>
          <select
            id={selectId}
            value={selectValue}
            disabled={pending}
            onChange={(e) => onCategory(e.target.value || null)}
            className={`h-11 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 sm:h-8 ${FOCUS}`}
          >
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {legacy && <option value={legacy}>{legacy}</option>}
            <option value="">{OTHER_SLOT}</option>
          </select>
          {pending && <span className="text-xs text-slate-400">Saving…</span>}
        </div>
      )}

      {swap && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3" aria-live="polite">
          {swap.status === "loading" && <p className="text-xs text-slate-500">Finding safe alternatives…</p>}
          {swap.status === "error" && <p className="text-xs text-rose-700">{swap.message}</p>}
          {swap.status === "ready" && swap.options.length === 0 && (
            <p className="text-xs text-slate-500">No other safe, fresh {slot.toLowerCase()} to swap in right now. Try the finder.</p>
          )}
          {swap.status === "ready" && swap.options.length > 0 && (
            <>
              <p className="text-xs font-medium text-slate-500">Swap for</p>
              <ul className="mt-1.5 space-y-1.5">
                {swap.options.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => onPickSwap(hit)}
                      className={`block min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-[var(--accent)] ${FOCUS}`}
                    >
                      <span className="block truncate text-sm font-medium text-slate-900">{hit.title}</span>
                      {hit.description && <span className="block truncate text-xs text-slate-500">{hit.description}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={onCloseSwap}
            className={`mt-2 min-h-11 rounded-lg px-2 text-xs font-medium text-slate-500 hover:text-slate-800 sm:min-h-8 ${FOCUS}`}
          >
            Keep {dish.title}
          </button>
        </div>
      )}
    </li>
  );
}
