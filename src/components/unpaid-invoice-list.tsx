"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { bulkRecordPayment } from "@/app/actions";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

export type UnpaidInvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  dateLabel: string;
  status: string;
  total: number;
};

export function UnpaidInvoiceList({
  invoices,
  today,
}: {
  invoices: UnpaidInvoiceRow[];
  /** YYYY-MM-DD in the kitchen's time zone, worked out on the server. */
  today: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [date, setDate] = useState(today);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Drop selections for invoices that are no longer listed (e.g. just paid).
  const visibleSelected = invoices.filter((inv) => selected.has(inv.id));
  const selectedTotal = visibleSelected.reduce((s, inv) => s + inv.total, 0);
  const allSelected = invoices.length > 0 && visibleSelected.length === invoices.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMessage(null);
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(invoices.map((inv) => inv.id)));
    setMessage(null);
  }

  function markPaid() {
    const ids = visibleSelected.map((inv) => inv.id);
    if (ids.length === 0) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const { paid, skipped } = await bulkRecordPayment(ids, method, date);
        setSelected(new Set());
        setMessage(
          `Marked ${paid} invoice${paid === 1 ? "" : "s"} as paid.` +
            (skipped > 0 ? ` ${skipped} skipped (already paid or void).` : ""),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not mark those invoices as paid.");
      }
    });
  }

  if (invoices.length === 0) {
    return (
      <div className="space-y-3">
        {message && <p className="text-sm font-medium text-emerald-700" role="status">{message}</p>}
        <p className="panel px-5 py-8 text-center text-sm muted">
          Every invoice is marked paid.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="text-sm font-medium text-emerald-700" role="status">
          {message}
        </p>
      )}

      <div className="panel overflow-hidden">
        <label className="flex min-h-12 cursor-pointer items-center gap-4 border-b border-[var(--line)] px-5 py-2 text-sm muted">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="h-5 w-5 rounded border-[var(--line)] accent-[var(--accent)]"
          />
          Select all ({invoices.length})
        </label>
        <ul className="divide-y divide-[var(--line)]">
          {invoices.map((inv) => {
            const checked = selected.has(inv.id);
            return (
              <li
                key={inv.id}
                className={`flex items-center gap-1 px-5 py-2 ${checked ? "bg-[var(--surface-raised)]" : ""}`}
              >
                {/* 44px hit area around the checkbox */}
                <label className="-ml-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(inv.id)}
                    aria-label={`Select invoice #${inv.invoiceNumber} for ${inv.clientName}`}
                    className="h-5 w-5 rounded border-[var(--line)] accent-[var(--accent)]"
                  />
                </label>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {inv.clientName}
                      <span className="font-normal muted"> · #{inv.invoiceNumber}</span>
                    </p>
                    <p className="mt-1 text-sm muted">{inv.dateLabel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-ink">{formatMoney(inv.total)}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {visibleSelected.length > 0 && (
        <div
          className="panel sticky bottom-24 z-40 flex flex-col gap-4 px-5 py-4 shadow-lg md:flex-row md:items-end lg:bottom-4"
          role="region"
          aria-label="Mark selected as paid"
        >
          <p className="text-sm text-ink md:mr-auto md:self-center">
            <span className="font-semibold">{visibleSelected.length} selected</span>
            <span className="muted"> · {formatMoney(selectedTotal)}</span>
          </p>
          <label className="flex flex-col gap-1 text-sm muted">
            Paid by
            <select
              className="field md:w-36"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm muted">
            Date paid
            <input
              className="field md:w-44"
              type="date"
              value={date}
              max={today}
              required
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="button-primary"
            disabled={pending || !date}
            onClick={markPaid}
          >
            {pending ? "Saving…" : "Mark selected as paid"}
          </button>
          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
