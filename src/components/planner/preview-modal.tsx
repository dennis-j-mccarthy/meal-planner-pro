"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { SlotGroup } from "./planner-logic";
import { DISPLAY_FONT, FOCUS } from "./ui";

/** What the client will see, before a review link exists. */
export function PreviewModal({
  firstName,
  dateLabel,
  groups,
  onClose,
}: {
  firstName: string;
  dateLabel: string;
  groups: SlotGroup[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[#faf9f7] p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Preview · what {firstName} sees</p>
            <h2 id="preview-title" className="mt-1 text-2xl text-slate-900" style={DISPLAY_FONT}>
              Your menu for {dateLabel}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`min-h-11 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 ${FOCUS}`}
          >
            Close
          </button>
        </div>
        {groups.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No dishes yet.</p>
        ) : (
          groups.map((g) => (
            <section key={g.name} className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-strong)]">{g.name}</h3>
              <ul className="mt-2 space-y-2">
                {g.dishes.map((d) => (
                  <li key={d.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{d.title}</p>
                    {d.description && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{d.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
        <p className="mt-6 text-xs text-slate-500">
          Once you send it, {firstName} gets a link to remove anything they&apos;d skip, leave a note, and approve.
        </p>
      </div>
    </div>
  );
}
