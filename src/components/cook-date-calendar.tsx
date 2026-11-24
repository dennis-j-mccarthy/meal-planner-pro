"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { COOK_DATE_LEGEND, statusDotClass, statusLabel } from "@/lib/status";

const noopSubscribe = () => () => {};

export type CalendarCookDate = {
  id: string;
  /** Where the entry opens; a cook date's own page when not set. */
  href?: string;
  /** Set for cooking days known only from an invoice. */
  invoiceNumber?: string;
  scheduledFor: string; // ISO string
  startTimeLabel: string | null;
  guestCount: number | null;
  status: string;
  serviceNotes: string | null;
  clientName: string;
  proposalTitle: string | null;
};

type CalendarClient = {
  id: string;
  firstName: string;
  lastName: string;
};

type CookDateCalendarProps = {
  cookDates: CalendarCookDate[];
  initialMonth: number; // 0-11
  initialYear: number;
  clients?: CalendarClient[];
  onDateSelect?: (dateStr: string) => void;
  onMonthChange?: (month: number, year: number) => void;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Rough time per cook date (shopping, cooking, clean-up) for the month estimate.
const HOURS_PER_COOK_DATE = 8;

export function CookDateCalendar({ cookDates, initialMonth, initialYear, clients, onDateSelect, onMonthChange }: CookDateCalendarProps) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [creatingClientId, setCreatingClientId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Portals need the DOM; only render the popup after mount
  // true in the browser, false during server render (portals need the DOM)
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  function closeModal() {
    setSelectedDate(null);
    setCreatingClientId(null);
    setCreateError(null);
  }

  // Close the day popup on Escape
  useEffect(() => {
    if (!selectedDate) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDate]);

  async function createCookDate(clientId: string) {
    if (!selectedDate || creatingClientId) return;
    const parts = selectedDate.split("-");
    const isoDate = `${parts[0]}-${String(Number(parts[1]) + 1).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
    setCreateError(null);
    setCreatingClientId(clientId);
    try {
      const res = await fetch("/api/cook-dates/quick-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, date: isoDate }),
      });
      const data = await res.json();
      if (data.proposalUrl) {
        router.push(data.proposalUrl);
      } else {
        setCreatingClientId(null);
        setCreateError(data.error || "Failed to create cook date");
      }
    } catch {
      setCreatingClientId(null);
      setCreateError("Failed to create cook date");
    }
  }

  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build a map of date string -> cook dates
  const dateMap = new Map<string, CalendarCookDate[]>();
  for (const cd of cookDates) {
    const d = new Date(cd.scheduledFor);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!dateMap.has(key)) dateMap.set(key, []);
    dateMap.get(key)!.push(cd);
  }

  function prevMonth() {
    let m: number, y: number;
    if (month === 0) {
      m = 11; y = year - 1;
    } else {
      m = month - 1; y = year;
    }
    setMonth(m); setYear(y);
    setSelectedDate(null);
    onMonthChange?.(m, y);
  }

  function nextMonth() {
    let m: number, y: number;
    if (month === 11) {
      m = 0; y = year + 1;
    } else {
      m = month + 1; y = year;
    }
    setMonth(m); setYear(y);
    setSelectedDate(null);
    onMonthChange?.(m, y);
  }

  function goToToday() {
    const today = new Date();
    const m = today.getMonth();
    const y = today.getFullYear();
    setMonth(m); setYear(y);
    setSelectedDate(null);
    onMonthChange?.(m, y);
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Build grid cells
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < startDow; i++) {
    cells.push({ day: null, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: `day-${d}` });
  }

  const selectedCookDates = selectedDate ? dateMap.get(selectedDate) || [] : [];

  // This month's cook dates (not cancelled) and the estimated hours.
  let monthCount = 0;
  for (const [key, list] of dateMap) {
    if (key.startsWith(`${year}-${month}-`)) monthCount += list.filter((cd) => cd.status !== "CANCELLED").length;
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="section-title">
            {MONTH_NAMES[month]} {year}
          </h2>
          <p className="text-sm text-slate-500">
            {monthCount} cook date{monthCount === 1 ? "" : "s"}
            {monthCount > 0 && (
              <>
                {" · "}
                <span title={`${HOURS_PER_COOK_DATE} hours per cook date`}>
                  about {monthCount * HOURS_PER_COOK_DATE} hours cooking
                </span>
              </>
            )}
          </p>
          <button
            type="button"
            onClick={goToToday}
            className="button-secondary px-3"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Next month"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAY_NAMES.map((name) => (
            <div key={name} className="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              {name}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            if (cell.day === null) {
              return <div key={cell.key} className="min-h-24 border-b border-r border-slate-100 bg-slate-50/50" />;
            }

            const dateKey = `${year}-${month}-${cell.day}`;
            const events = dateMap.get(dateKey) || [];
            const isToday = dateKey === todayKey;
            const isSelected = dateKey === selectedDate;

            return (
              <button
                type="button"
                key={cell.key}
                onClick={() => {
                  setSelectedDate(isSelected ? null : dateKey);
                  setCreatingClientId(null);
                  setCreateError(null);
                  if (!isSelected && onDateSelect) {
                    // Format as YYYY-MM-DD for date input
                    const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
                    onDateSelect(isoDate);
                  }
                }}
                className={`min-h-24 border-b border-r border-slate-100 p-1.5 text-left align-top flex flex-col transition hover:bg-slate-50 ${
                  isSelected ? "bg-[var(--accent-light)] ring-1 ring-inset ring-[var(--accent)]" : ""
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? "bg-[var(--accent)] text-white"
                      : "text-slate-700"
                  }`}
                >
                  {cell.day}
                </span>
                {events.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {events.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        role="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(ev.href ?? `/cook-dates/${ev.id}`);
                        }}
                        className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-100"
                      >
                        <span className={statusDotClass(ev.status)} />
                        <span className="truncate text-xs font-medium text-slate-700">
                          {ev.clientName}
                        </span>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <p className="px-1 text-xs text-slate-500">+{events.length - 3} more</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date popup */}
      {selectedDate && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900">
                {(() => {
                  const parts = selectedDate.split("-");
                  const d = new Date(Number(parts[0]), Number(parts[1]), Number(parts[2]));
                  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                })()}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Existing cook dates for this day */}
            {selectedCookDates.length > 0 && (
              <div className="mt-4 space-y-3">
                {selectedCookDates.map((cd) => (
                  <div
                    key={cd.id}
                    onClick={() => router.push(cd.href ?? `/cook-dates/${cd.id}`)}
                    className="cursor-pointer rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{cd.clientName}</h4>
                        {cd.invoiceNumber ? (
                          <>
                            <p className="mt-1 text-xs text-slate-500">
                              Cooked · from invoice #{cd.invoiceNumber}
                            </p>
                            <p className="mt-2 text-xs font-medium text-[var(--accent-strong)]">
                              Open invoice &rarr;
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-1 text-xs text-slate-500">
                              {cd.startTimeLabel || "No time set"}
                              {cd.guestCount ? ` · ${cd.guestCount} guest${cd.guestCount !== 1 ? "s" : ""}` : ""}
                            </p>
                            {cd.serviceNotes && (
                              <p className="mt-2 text-sm text-slate-600">{cd.serviceNotes}</p>
                            )}
                            <p className="mt-2 text-xs text-slate-400">
                              {cd.proposalTitle || "No approved menu yet"}
                            </p>
                            <p className="mt-2 text-xs font-medium text-[var(--accent-strong)]">
                              Open cook date &rarr;
                            </p>
                          </>
                        )}
                      </div>
                      <StatusBadge status={cd.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Choose a client to add a cook date */}
            {clients && clients.length > 0 ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {selectedCookDates.length > 0 ? "Add another cook date" : "Add a cook date"} — choose a client
                </p>
                <div className="mt-2 space-y-1">
                  {clients.map((c) => {
                    const isCreating = creatingClientId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={creatingClientId !== null}
                        onClick={() => createCookDate(c.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-[var(--accent)] hover:bg-[var(--accent-light)] disabled:opacity-50"
                      >
                        <span>{c.firstName} {c.lastName}</span>
                        <span className="text-xs text-slate-400">
                          {isCreating ? "Creating…" : "+ Cook date"}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {createError && (
                  <p className="mt-2 text-xs font-medium text-red-600">{createError}</p>
                )}
              </div>
            ) : (
              selectedCookDates.length === 0 && (
                <p className="mt-4 text-sm text-slate-500">No cook dates scheduled.</p>
              )
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        {COOK_DATE_LEGEND.map((status) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={statusDotClass(status)} />
            {statusLabel(status)}
          </div>
        ))}
      </div>
    </div>
  );
}
