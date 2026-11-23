// Small, pure helpers for the inbound-email paths (menu@, invoice@, replies).
// No database or email imports here, so these can be tested on their own.

// Webhooks have no signed-in user, so the kitchen comes from the address the
// mail was sent to: anything@ → Beth's kitchen; menu-test@, invoice-test@
// (any local part ending in "-test") → the test kitchen.
export const LIVE_KITCHEN_ID = "kitchen_jwb";
export const TEST_KITCHEN_ID = "cmo96j8uw000004ifb190wwyx";

const MAIL_DOMAIN = "joyfulwellnesswithbeth.com";

export function inboundKitchenId(recipients: string[]): string {
  const isTest = recipients.some((a) => /-test@/i.test(a));
  return isTest ? TEST_KITCHEN_ID : LIVE_KITCHEN_ID;
}

// invoice@, invoices@, invoice-test@, invoices-test@
export function isInvoiceAddress(address: string): boolean {
  return /^invoices?(-test)?@/i.test(address);
}

// Where replies to an invoice summary go (so "Paid Zelle" lands back here).
export function invoiceAddressFor(kitchenId: string): string {
  return kitchenId === TEST_KITCHEN_ID
    ? `invoice-test@${MAIL_DOMAIN}`
    : `invoice@${MAIL_DOMAIN}`;
}

// "Send: yes" / "Send client" / "send" on its own line: also email the PDF to
// the client. Removed from the body before the menu or invoice parser sees it.
export const SEND_LINE_RE = /^send\s*:?\s*(yes|y|client)?\s*$/i;

export function stripSendLine(body: string): { body: string; send: boolean } {
  let send = false;
  const kept: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (SEND_LINE_RE.test(trimmed)) {
      send = true;
      continue;
    }
    // A quoted "> Send: yes" (forwarded mail) is dropped but does not send.
    if (SEND_LINE_RE.test(trimmed.replace(/^(>\s?)+/, "").trim())) continue;
    kept.push(raw);
  }
  return { body: kept.join("\n"), send };
}

// The new text of a reply: everything above the first quoted line (">") or
// the "On ... wrote:" line.
export function replyText(body: string): string {
  const out: string[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith(">") || /^On .+ wrote:$/.test(line)) break;
    out.push(raw);
  }
  return out.join("\n");
}

export function firstNonEmptyLine(text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line) return line;
  }
  return null;
}

export const PAID_LINE_RE =
  /^paid\b\s*(by\s+)?(zelle|check|cheque|cash|card|venmo|stripe)?\s*#?\s*(\S+)?/i;

// "Paid Zelle" → { method: "Zelle", note: null }
// "Paid check 1043" / "Paid by check #1043" → { method: "Check", note: "1043" }
// "Paid" → { method: "Other", note: null }
export function parsePaidLine(line: string): { method: string; note: string | null } | null {
  const m = line.match(PAID_LINE_RE);
  if (!m) return null;
  const word = (m[2] ?? "").toLowerCase();
  const method = !word
    ? "Other"
    : word === "cheque"
      ? "Check"
      : word[0].toUpperCase() + word.slice(1);
  // The note is the rest of the line after "paid [by] [method]".
  const head = line.match(/^paid\b\s*(by\s+)?(zelle|check|cheque|cash|card|venmo|stripe)?/i)![0];
  const rest = line.slice(head.length).replace(/^[\s#:—–-]+/, "").trim();
  return { method, note: /[a-z0-9]/i.test(rest) ? rest : null };
}

// "2026-11-23" for the calendar day of d in US Eastern.
export function easternDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// "11/23/2026" for today in US Eastern.
export function easternToday(): string {
  return new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });
}

// How client-facing email is signed.
export function chefSignoff(kitchen: { id: string; name: string }): string {
  return kitchen.id === LIVE_KITCHEN_ID ? "Beth" : kitchen.name;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
