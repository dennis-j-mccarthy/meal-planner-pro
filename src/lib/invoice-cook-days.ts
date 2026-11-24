// Cooking days that live only on invoices. Most of Beth's past cooks were
// never entered as cook dates; her invoices name them instead ("Personal
// Chef – Tuesday, November 10", "Personal Chef Service (April 6, 13, 20,
// 27)"), or the invoice date stands for the day. The calendar shows these so
// past months are not empty. Read-only: nothing is created from them.

import { todayYmd } from "@/lib/dates";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const MONTH_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2}(?:\s*(?:,|&|and)\s*\d{1,2})*)\b/gi;

/** Only chef-service lines count as a cooking day (not Groceries or Travel). */
export function isChefLine(description: string) {
  return /chef|cook/i.test(description) && !/grocer|travel/i.test(description);
}

/** "YYYY-MM-DD" days a chef line names, or the invoice's own day when it names none. */
export function cookDaysFromLine(description: string, invoiceDate: Date): string[] {
  const invoiceYmd = todayYmd(invoiceDate);
  const invYear = Number(invoiceYmd.slice(0, 4));
  const invMonth = Number(invoiceYmd.slice(5, 7)) - 1;
  const days = new Set<string>();
  for (const m of description.matchAll(MONTH_RE)) {
    const month = MONTHS.findIndex((name) => name.startsWith(m[1].toLowerCase().slice(0, 3)));
    if (month < 0) continue;
    // A date far from the invoice month belongs to the neighbouring year.
    const year = month - invMonth > 6 ? invYear - 1 : invMonth - month > 6 ? invYear + 1 : invYear;
    for (const d of m[2].split(/\s*(?:,|&|and)\s*/)) {
      const day = Number(d);
      if (day >= 1 && day <= 31) {
        days.add(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
      }
    }
  }
  return days.size ? [...days] : [invoiceYmd];
}
