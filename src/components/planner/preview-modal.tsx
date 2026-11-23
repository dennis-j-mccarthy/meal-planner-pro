"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { FOCUS } from "./ui";

/** What the client will see: their real menu page, with its buttons (nothing is saved or sent). */
export function PreviewModal({
  proposalId,
  firstName,
  onClose,
}: {
  proposalId: string;
  firstName: string;
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
        aria-label={`What ${firstName} sees`}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">What {firstName} sees</p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className={`min-h-11 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 ${FOCUS}`}
          >
            Close
          </button>
        </div>
        <iframe src={`/preview/review/${proposalId}`} title={`What ${firstName} sees`} className="w-full flex-1 border-0" />
      </div>
    </div>
  );
}
