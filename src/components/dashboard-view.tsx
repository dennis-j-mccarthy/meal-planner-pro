"use client";

import { useState } from "react";
import Link from "next/link";
import { CookDateCalendar, type CalendarCookDate } from "@/components/cook-date-calendar";
import { StatusBadge } from "@/components/status-badge";
import { formatMoney } from "@/lib/format";

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

interface DashboardClient {
  id: string;
  firstName: string;
  lastName: string;
}

function formatLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function DashboardView({
  cookDates,
  invoices,
  clients,
  initialMonth,
  initialYear,
  todayIso,
  belowCalendar,
  invoiceCooks = [],
}: {
  /** Cooking days known only from invoices; shown on the calendar only. */
  invoiceCooks?: CalendarCookDate[];
  /** Shown between the calendar and the month's lists (stats, Needs you). */
  belowCalendar?: React.ReactNode;
  cookDates: CookDateItem[];
  invoices: InvoiceItem[];
  clients: DashboardClient[];
  /** 0-11, from the server (kitchen time zone). */
  initialMonth: number;
  initialYear: number;
  /** Start of today (kitchen time zone), ISO. */
  todayIso: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [showPast, setShowPast] = useState(true);

  // Cook dates in the selected month
  const monthCookDates = cookDates.filter((cd) => {
    const d = new Date(cd.scheduledFor);
    if (d.getMonth() !== month || d.getFullYear() !== year) return false;
    if (!showPast && cd.scheduledFor < todayIso) return false;
    return true;
  });

  // Invoices dated in the selected month
  const monthInvoices = invoices.filter((inv) => {
    const d = new Date(inv.invoiceDate);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const unpaidTotal = monthInvoices
    .filter((inv) => inv.status === "DRAFT" || inv.status === "SENT")
    .reduce((sum, inv) => sum + inv.total, 0);
  const paidTotal = monthInvoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + inv.total, 0);
  const monthTotal = monthInvoices
    .filter((inv) => inv.status !== "VOID")
    .reduce((sum, inv) => sum + inv.total, 0);

  return (
    <>
      {/* Calendar */}
      <section className="panel p-4 sm:p-6" aria-label="Calendar">
        <CookDateCalendar
          cookDates={[...cookDates, ...invoiceCooks]}
          initialMonth={initialMonth}
          initialYear={initialYear}
          clients={clients}
          onMonthChange={(m, y) => {
            setMonth(m);
            setYear(y);
          }}
        />
      </section>

      {belowCalendar}

      {/* Month label */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-bold text-slate-900">
          {MONTH_NAMES[month]} {year}
          <span className="ml-2 text-sm font-normal text-slate-500">
            {monthCookDates.length} cook date{monthCookDates.length !== 1 ? "s" : ""} ·{" "}
            {monthInvoices.length} invoice{monthInvoices.length !== 1 ? "s" : ""}
          </span>
        </p>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showPast}
            onChange={(e) => setShowPast(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 accent-[var(--accent)]"
          />
          Show past cook dates
        </label>
      </div>

      {/* Two columns: cook dates + invoices for the selected month */}
      <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="panel p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">
              Cook dates
              <span className="ml-2 text-sm font-normal text-slate-500">{monthCookDates.length}</span>
            </h3>
            <Link href="/proposals" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent-strong)] hover:underline">
              Meal Planner &rarr;
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {monthCookDates.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No cook dates in {MONTH_NAMES[month]}.</p>
            ) : (
              monthCookDates.map((cd) => (
                <Link
                  key={cd.id}
                  href={`/cook-dates/${cd.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-[var(--accent)] hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500">
                        {formatLong(cd.scheduledFor)}
                        {cd.startTimeLabel ? ` · ${cd.startTimeLabel}` : ""}
                      </p>
                      <h4 className="mt-1 truncate text-base font-semibold text-slate-900">{cd.clientName}</h4>
                      {cd.proposalTitle && <p className="mt-0.5 truncate text-xs text-slate-500">{cd.proposalTitle}</p>}
                    </div>
                    <StatusBadge status={cd.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">
              Invoices
              <span className="ml-2 text-sm font-normal text-slate-500">{monthInvoices.length}</span>
            </h3>
            {monthTotal > 0 && <p className="text-lg font-bold text-green-600">{formatMoney(monthTotal)}</p>}
          </div>
          {(unpaidTotal > 0 || paidTotal > 0) && (
            <div className="mt-1 flex justify-end gap-3 text-xs font-medium">
              {unpaidTotal > 0 && <span className="text-amber-600">{formatMoney(unpaidTotal)} not marked paid</span>}
              {paidTotal > 0 && <span className="text-green-600">{formatMoney(paidTotal)} paid</span>}
            </div>
          )}
          <div className="mt-4 space-y-2">
            {monthInvoices.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No invoices in {MONTH_NAMES[month]}.</p>
            ) : (
              monthInvoices.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-[var(--accent)] hover:shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900">#{inv.invoiceNumber}</span>
                    <StatusBadge status={inv.status} />
                    <span className="truncate text-xs text-slate-500">{inv.clientName}</span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-900">{formatMoney(inv.total)}</span>
                </Link>
              ))
            )}
          </div>
          <Link href="/money" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent-strong)] hover:underline">
            Money &rarr;
          </Link>
        </div>
      </section>
    </>
  );
}
