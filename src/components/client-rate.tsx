"use client";

import { Check, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setClientRate } from "@/app/actions";

// The client's fee per cook date (and travel), shown on the cook date and in
// the planner. Edited in place; new invoices start from it.

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function ClientRate({
  clientId,
  rate: initialRate,
  travel: initialTravel,
}: {
  clientId: string;
  rate: number | null;
  travel: number | null;
}) {
  const router = useRouter();
  // Shows the saved amounts straight away instead of waiting for the refresh.
  const [{ rate, travel }, setSaved] = useState({ rate: initialRate, travel: initialTravel });
  const [editing, setEditing] = useState(false);
  const [rateText, setRateText] = useState(initialRate != null ? String(initialRate) : "");
  const [travelText, setTravelText] = useState(initialTravel != null ? String(initialTravel) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const res = await setClientRate(clientId, rateText, travelText);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved({ rate: res.rate, travel: res.travel });
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return rate != null ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-medium text-slate-700">
          {money(rate)} per cook date
          {travel ? ` · ${money(travel)} travel` : ""}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Change rate"
          title="Change rate"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-[var(--surface-raised)] hover:text-slate-700 [&>svg]:h-3.5 [&>svg]:w-3.5"
        >
          <Pencil aria-hidden="true" />
        </button>
      </span>
    ) : (
      <span className="inline-flex items-center gap-2">
        <span className="text-amber-700">No rate set</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 font-semibold text-[var(--accent-strong)] hover:underline [&>svg]:h-3.5 [&>svg]:w-3.5"
        >
          <Plus aria-hidden="true" />
          Add rate
        </button>
      </span>
    );
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, autoFocus = false) => (
    <label htmlFor={id} className="inline-flex items-center gap-2">
      <span className="text-slate-600">{label}</span>
      <span className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => set(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="0"
          className="h-9 w-24 rounded-lg border border-[var(--line)] bg-white pl-6 pr-2 text-sm text-ink"
        />
      </span>
    </label>
  );

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
      {field(`rate-${clientId}`, "Per cook date", rateText, setRateText, true)}
      {field(`travel-${clientId}`, "Travel", travelText, setTravelText)}
      <span className="inline-flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving} className="button-primary !min-h-9 !py-1 text-sm disabled:opacity-60">
          <Check aria-hidden="true" />
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
          }}
          className="button-secondary !min-h-9 !py-1 text-sm"
        >
          Cancel
        </button>
      </span>
      {error && <span className="w-full text-red-600">{error}</span>}
    </span>
  );
}
