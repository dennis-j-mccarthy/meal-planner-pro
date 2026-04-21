"use client";

import { useState, useRef, useEffect } from "react";

interface QuickCookDateProps {
  clientId: string;
  iconOnly?: boolean;
}

export function QuickCookDate({ clientId, iconOnly = false }: QuickCookDateProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleCreate() {
    if (!date) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/cook-dates/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, date }),
      });
      const data = await res.json();
      if (data.proposalUrl) {
        window.location.href = data.proposalUrl;
      }
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div ref={ref}>
      {iconOnly ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
          title="New cook date"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v-3m-1.5 1.5h3" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="button-primary text-xs px-3 py-1.5"
        >
          + Cook date
        </button>
      )}

      {open && (
        <div className="fixed inset-0 m-auto z-[200] rounded-xl border border-slate-200 bg-white p-5 shadow-2xl w-72 h-fit">
          <p className="text-xs font-semibold text-slate-700 mb-2">
            Select a date
          </p>
          <input
            type="date"
            autoFocus
            className="field text-sm w-full"
            min={new Date().toISOString().slice(0, 10)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!date || submitting}
            className="button-primary text-sm w-full mt-3 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Add cook date"}
          </button>
        </div>
      )}
    </div>
  );
}
