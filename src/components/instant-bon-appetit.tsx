"use client";

import { useState, useRef, useEffect } from "react";

interface InstantBonAppetitProps {
  clientId: string;
  clientName: string;
}

export function InstantBonAppetit({ clientId, clientName }: InstantBonAppetitProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  async function handleCreate() {
    if (!text.trim() || !date) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bon-appetit/instant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, date, text }),
      });
      const data = await res.json();
      if (data.bonAppetitUrl) {
        window.location.href = data.bonAppetitUrl;
      }
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary text-xs px-3 py-1.5 border-purple-200 text-purple-700 hover:bg-purple-50"
      >
        Instant BA
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-black/40 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Instant Bon Appetit
            </h2>
            <p className="text-xs text-slate-500">{clientName}</p>
          </div>
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
          <p className="text-sm text-slate-600 mb-4">
            Paste the full menu below. Use category headers on their own line
            (e.g. &quot;Entrees and Sides&quot;, &quot;Morning Nourishment&quot;).
            Each recipe should have a title line followed by a description.
          </p>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Cook date
            </label>
            <input
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Menu
            </label>
            <textarea
              className="field min-h-64 text-sm font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Entrees and Sides\nMediterranean Baked Chicken Breasts with Burst Cherry Tomatoes\nThis vibrant dish features tender chicken...\n\nLemon-Kissed Crispy Chicken Cutlets\nGolden, lightly crisped cutlets...\n\nMorning Nourishment\nGreen Goddess Smoothie Bowl\nA vibrant blend of...`}
            />
          </div>
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
            onClick={handleCreate}
            disabled={!text.trim() || !date || submitting}
            className="button-primary text-sm disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Bon Appetit"}
          </button>
        </div>
      </dialog>
    </>
  );
}
