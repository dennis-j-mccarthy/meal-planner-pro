"use client";

import { useState } from "react";
import Link from "next/link";
import { CookDateCalendar } from "@/components/cook-date-calendar";
import { StatusBadge } from "@/components/status-badge";

interface CookDateItem {
  id: string;
  scheduledFor: string;
  startTimeLabel: string | null;
  guestCount: number | null;
  status: string;
  serviceNotes: string | null;
  clientName: string;
  proposalTitle: string | null;
}

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  clientName: string;
  total: number;
}

function formatLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface DashboardClient {
  id: string;
  firstName: string;
  lastName: string;
}

export function DashboardView({
  cookDates,
  invoices,
  clients,
}: {
  cookDates: CookDateItem[];
  invoices: InvoiceItem[];
  clients: DashboardClient[];
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [showPast, setShowPast] = useState(false);

  // Filter cook dates for selected month
  const monthCookDates = cookDates.filter((cd) => {
    const d = new Date(cd.scheduledFor);
    if (d.getMonth() !== month || d.getFullYear() !== year) return false;
    if (!showPast && d < now) return false;
    return true;
  });

  // Filter invoices for selected month
  const monthInvoices = invoices.filter((inv) => {
    const d = new Date(inv.invoiceDate);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  // Totals
  const unpaidTotal = monthInvoices
    .filter((inv) => inv.status === "DRAFT" || inv.status === "SENT")
    .reduce((sum, inv) => sum + inv.total, 0);
  const paidTotal = monthInvoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + inv.total, 0);
  const monthTotal = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);

  function handleMonthChange(m: number, y: number) {
    setMonth(m);
    setYear(y);
  }

  return (
    <>
      {/* Calendar */}
      <section className="panel p-6">
        <CookDateCalendar
          cookDates={cookDates}
          initialMonth={now.getMonth()}
          initialYear={now.getFullYear()}
          clients={clients}
          onMonthChange={handleMonthChange}
        />
      </section>

      {/* Month label */}
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-slate-900">
          {MONTH_NAMES[month]} {year}
          <span className="ml-2 text-sm font-normal text-slate-500">
            {monthCookDates.length} cook dates · {monthInvoices.length} invoices
          </span>
        </p>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showPast}
            onChange={(e) => setShowPast(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[var(--accent)]"
          />
          Show past cook dates
        </label>
      </div>

      {/* Two-column: cook dates + invoices for selected month */}
      <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="panel p-6">
          <h3 className="text-lg font-bold text-slate-900">
            Cook dates
            <span className="ml-2 text-sm font-normal text-slate-500">
              {monthCookDates.length}
            </span>
          </h3>
          <div className="mt-4 space-y-3">
            {monthCookDates.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No cook dates in {MONTH_NAMES[month]}.
              </p>
            ) : (
              monthCookDates.map((cd) => (
                <Link
                  key={cd.id}
                  href={`/cook-dates/${cd.id}`}
                  className="block rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        {formatLong(cd.scheduledFor)}
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-slate-900">
                        {cd.clientName}
                      </h4>
                    </div>
                    <StatusBadge label={formatStatus(cd.status)} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">
              Invoices
              <span className="ml-2 text-sm font-normal text-slate-500">
                {monthInvoices.length}
              </span>
            </h3>
            {monthTotal > 0 && (
              <p className="text-lg font-bold text-green-600">
                ${monthTotal.toFixed(2)}
              </p>
            )}
          </div>
          {(unpaidTotal > 0 || paidTotal > 0) && (
            <div className="mt-1 flex justify-end gap-3 text-xs">
              {unpaidTotal > 0 && (
                <span className="text-amber-600">
                  ${unpaidTotal.toFixed(2)} unpaid
                </span>
              )}
              {paidTotal > 0 && (
                <span className="text-green-600">
                  ${paidTotal.toFixed(2)} paid
                </span>
              )}
            </div>
          )}
          <div className="mt-4 space-y-2">
            {monthInvoices.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">
                No invoices in {MONTH_NAMES[month]}.
              </p>
            ) : (
              monthInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-semibold text-slate-900">
                      #{inv.invoiceNumber}
                    </span>
                    <StatusBadge label={inv.status} />
                    <span className="text-xs text-slate-500 truncate">
                      {inv.clientName}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 shrink-0">
                    ${inv.total.toFixed(2)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
