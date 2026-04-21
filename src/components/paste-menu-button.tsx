"use client";

import { useState, useRef, useEffect } from "react";

export function PasteMenuButton({ proposalId }: { proposalId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals/paste-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, text }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(`Failed: ${data.error || "Unknown error"}`);
        setSubmitting(false);
      }
    } catch {
      alert("Failed to parse menu");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary text-sm border-purple-200 text-purple-700 hover:bg-purple-50"
      >
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m8.25-8.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 0 0-2.25 2.25v6" />
        </svg>
        Paste menu
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-black/40 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Paste menu</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          <p className="text-sm text-slate-600 mb-3">
            Paste the full menu text below. Category headers (Entrees, Breakfast, etc.)
            and recipe descriptions will be parsed automatically. Personal notes and
            signoffs are stripped.
          </p>
          <textarea
            className="field min-h-80 text-sm font-mono"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Entrees\n\nChicken Parmesan\nBreaded chicken breast with marinara...\n\nLemon Salmon\nGrilled salmon with fresh lemon...\n\nBreakfast\n\nOvernight Oats\nRolled oats with chia and berries...`}
            autoFocus
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="button-secondary text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="button-primary text-sm disabled:opacity-50"
          >
            {submitting ? "Parsing with AI..." : "Parse & add to menu"}
          </button>
        </div>
      </dialog>
    </>
  );
}
