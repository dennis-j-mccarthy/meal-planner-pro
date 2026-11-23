"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type PlanMenuClient = { id: string; firstName: string; lastName: string };

/** An existing cook date that already has a menu: picking it opens that menu instead of making a duplicate. */
export type PlanMenuExisting = { clientId: string; ymd: string; proposalId: string };

// "+ Plan a menu": pick a client and a date, then go straight to the planner.
// Uses the same quick-create endpoint as the calendar (cook date + draft menu).
export function PlanMenuButton({
  clients,
  existing = [],
  today,
  className = "button-primary",
  label = "+ Plan a menu",
}: {
  clients: PlanMenuClient[];
  existing?: PlanMenuExisting[];
  /** YYYY-MM-DD in the kitchen's time zone (from the server). */
  today: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => selectRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !date) return;
    setError(null);

    const match = existing.find((x) => x.clientId === clientId && x.ymd === date);
    if (match) {
      setBusy(true);
      router.push(`/proposals/${match.proposalId}`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/cook-dates/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, date }),
      });
      const data: { proposalUrl?: string; error?: string } = await res.json().catch(() => ({}));
      if (res.ok && data.proposalUrl) {
        router.push(data.proposalUrl);
        return;
      }
      setError(data.error || "Couldn't start the menu. Try again.");
    } catch {
      setError("Couldn't start the menu. Check your connection and try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => !busy && setOpen(false)}
          />
          <form
            onSubmit={go}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-menu-title"
            className="panel relative w-full max-w-md p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-white shadow-md">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <div>
                <h2 id="plan-menu-title" className="section-title">
                  Plan a menu
                </h2>
                <p className="mt-1 text-sm muted">Pick the client and the cook date. The planner opens next.</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="plan-menu-client" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Client
                </label>
                <select
                  id="plan-menu-client"
                  ref={selectRef}
                  className="field"
                  required
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="" disabled>
                    Select a client
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="plan-menu-date" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Cook date
                </label>
                <input
                  id="plan-menu-date"
                  type="date"
                  className="field"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>

            {clients.length === 0 && (
              <p className="mt-4 text-sm muted">Add a client first, then plan their menu.</p>
            )}
            {error && (
              <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="button-secondary">
                Cancel
              </button>
              <button type="submit" disabled={busy || !clientId || !date} className="button-primary">
                {busy ? "Opening the planner…" : "Open the planner"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
