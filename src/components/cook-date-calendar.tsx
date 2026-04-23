"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CalendarCookDate = {
  id: string;
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

function statusColor(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500";
    case "APPROVED":
    case "SCHEDULED":
      return "bg-[var(--accent)]";
    case "PROPOSED":
      return "bg-amber-400";
    case "CANCELLED":
      return "bg-slate-300";
    default:
      return "bg-slate-400";
  }
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function CookDateCalendar({ cookDates, initialMonth, initialYear, clients, onDateSelect, onMonthChange }: CookDateCalendarProps) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [quickClientId, setQuickClientId] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);

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

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            {MONTH_NAMES[month]} {year}
          </h2>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                  setQuickClientId("");
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
                          router.push(`/cook-dates/${ev.id}`);
                        }}
                        className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-100"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColor(ev.status)}`} />
                        <span className="truncate text-[10px] font-medium text-slate-700">
                          {ev.clientName}
                        </span>
                      </div>
                    ))}
                    {events.length > 3 && (
                      <p className="px-1 text-[10px] text-slate-400">+{events.length - 3} more</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date detail panel */}
      {selectedDate && (
        <div className="rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-bold text-slate-900">
            {(() => {
              const parts = selectedDate.split("-");
              const d = new Date(Number(parts[0]), Number(parts[1]), Number(parts[2]));
              return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
            })()}
          </h3>

          {/* Instant add cook date — only when clients provided */}
          {clients && clients.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <select
                className="field flex-1 text-sm"
                value={quickClientId}
                onChange={(e) => setQuickClientId(e.target.value)}
                disabled={quickSubmitting}
              >
                <option value="">+ Add cook date — pick a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!quickClientId || quickSubmitting}
                onClick={async () => {
                  const parts = selectedDate.split("-");
                  const isoDate = `${parts[0]}-${String(Number(parts[1]) + 1).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`;
                  setQuickSubmitting(true);
                  try {
                    const res = await fetch("/api/cook-dates/quick-create", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ clientId: quickClientId, date: isoDate }),
                    });
                    const data = await res.json();
                    if (data.proposalUrl) {
                      window.location.href = data.proposalUrl;
                    } else {
                      setQuickSubmitting(false);
                      alert(data.error || "Failed to create cook date");
                    }
                  } catch {
                    setQuickSubmitting(false);
                    alert("Failed to create cook date");
                  }
                }}
                className="button-primary text-sm px-4 py-2 disabled:opacity-50"
              >
                {quickSubmitting ? "Creating…" : "Add"}
              </button>
            </div>
          )}

          {selectedCookDates.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No cook dates scheduled.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {selectedCookDates.map((cd) => (
                <div
                  key={cd.id}
                  onClick={() => router.push(`/cook-dates/${cd.id}`)}
                  className="cursor-pointer rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{cd.clientName}</h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {cd.startTimeLabel || "No time set"}
                        {cd.guestCount ? ` · ${cd.guestCount} guests` : ""}
                      </p>
                      {cd.serviceNotes && (
                        <p className="mt-2 text-sm text-slate-600">{cd.serviceNotes}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-400">
                        {cd.proposalTitle || "No approved proposal yet"}
                      </p>
                      <p className="mt-2 text-xs font-medium text-[var(--accent-strong)]">
                        View meal plan &rarr;
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      cd.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
                      cd.status === "APPROVED" || cd.status === "SCHEDULED" ? "bg-teal-50 text-teal-700 ring-teal-200" :
                      cd.status === "PROPOSED" ? "bg-amber-50 text-amber-700 ring-amber-200" :
                      cd.status === "CANCELLED" ? "bg-slate-50 text-slate-500 ring-slate-200" :
                      "bg-slate-50 text-slate-600 ring-slate-200"
                    }`}>
                      {formatStatus(cd.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          Draft
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Proposed
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
          Approved / Scheduled
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Completed
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          Cancelled
        </div>
      </div>
    </div>
  );
}
