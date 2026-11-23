// Calendar-day helpers in Beth's time zone. The server runs in UTC, so
// "today" and date labels are worked out for America/New_York explicitly.
// Cook dates and invoice dates are stored at noon on their day, so a window
// that starts at 00:00 UTC of a day contains that day's records whether they
// were written at noon UTC (production) or noon Eastern (local dev).

export const KITCHEN_TIME_ZONE = "America/New_York";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11-23" for the current day in the kitchen's time zone. */
export function todayYmd(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KITCHEN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

/** 00:00 UTC of the given YYYY-MM-DD (the start of a day window). */
export function dayStart(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`);
}

/** Start of today's window. */
export function todayStart(now = new Date()) {
  return dayStart(todayYmd(now));
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** "2026-11" for the current month in the kitchen's time zone. */
export function thisMonthKey(now = new Date()) {
  return todayYmd(now).slice(0, 7);
}

/** [start, end) of a YYYY-MM month, or null when the key is malformed. */
export function monthRange(key: string) {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export function shiftMonthKey(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthKey(key: string) {
  const range = monthRange(key);
  if (!range) return key;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(range.start);
}

/** Format a stored date in the kitchen's time zone. */
export function formatInKitchen(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: KITCHEN_TIME_ZONE }).format(date);
}

/** "Monday, November 23" */
export function formatWeekdayLong(date: Date) {
  return formatInKitchen(date, { weekday: "long", month: "long", day: "numeric" });
}

/** "Mon, Nov 23" */
export function formatWeekdayShort(date: Date) {
  return formatInKitchen(date, { weekday: "short", month: "short", day: "numeric" });
}

/** "Nov 23, 2026" */
export function formatDayShort(date: Date) {
  return formatInKitchen(date, { month: "short", day: "numeric", year: "numeric" });
}
