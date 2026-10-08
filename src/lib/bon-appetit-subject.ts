const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

// Subject: "Client Name - M/D/YYYY", or month-only "Client Name - October 2026"
// / "October, 2026" / "10/2026". No date → today. monthOnly drops the day from
// the printed date ("October, 2026").
export function parseSubject(subject: string): {
  client: string;
  date: Date;
  monthOnly: boolean;
} {
  const raw = subject
    .replace(/^(re:|fwd:)\s*/i, "")
    .replace(/^bon\s*app[eé]tit\s*[-–:]?\s*/i, "")
    .trim();
  const sep = "^(.*?)[\\s\\-–,]+";
  const year = (y: string) => (Number(y) < 100 ? Number(y) + 2000 : Number(y));
  // Noon local time avoids any date-shift from timezone.
  const build = (client: string, y: number, mo: number, da: number, monthOnly: boolean) => {
    const d = new Date(y, mo - 1, da, 12, 0, 0);
    return {
      client: client.trim() || "Guest",
      date: isNaN(d.getTime()) ? new Date() : d,
      monthOnly: isNaN(d.getTime()) ? false : monthOnly,
    };
  };

  // M/D/YYYY
  let m = raw.match(new RegExp(sep + "(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4})\\s*$"));
  if (m) return build(m[1], year(m[4]), Number(m[2]), Number(m[3]), false);

  // M/YYYY
  m = raw.match(new RegExp(sep + "(\\d{1,2})\\/(\\d{4})\\s*$"));
  if (m) return build(m[1], Number(m[3]), Number(m[2]), 1, true);

  // October 2026 / October, 2026 / Oct 2026
  m = raw.match(new RegExp(sep + "([a-z]{3,9})\\.?,?\\s+(\\d{4})\\s*$", "i"));
  if (m) {
    const idx = MONTHS.findIndex((name) => name.startsWith(m![2].toLowerCase()));
    if (idx >= 0 && m[2].length >= 3) return build(m[1], Number(m[3]), idx + 1, 1, true);
  }

  return { client: raw || "Guest", date: new Date(), monthOnly: false };
}
