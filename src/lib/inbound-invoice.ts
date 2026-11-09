// Invoice-by-email: parse an emailed invoice request, match the client, create
// a DRAFT invoice in Beth's kitchen, render the PDF and email it.
//
//   To:       invoice@joyfulwellnesswithbeth.com
//   Subject:  Client Name - M/D/YYYY        (same as Bon Appetit)
//   Body:     PC: $425
//             Gro: $186.40
//             Tip                            (optional: adds the gratuity lines)
//             Note: anything for the Remarks box (optional)
//
// Prepaid cook dates: put the dates on their own line and one amount. Each
// date becomes a line item and the amount is split evenly across them.
//   Subject:  Invoice Schwartz              (no date = today)
//   Body:     1756
//             November 3, 10, 17

import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseSubject } from "@/lib/bon-appetit-subject";
import { buildInvoiceHtml } from "@/lib/invoice-template";
import { generatePdfFromHtml } from "@/lib/generate-pdf";
import { getNextInvoiceNumber } from "@/lib/invoice-number";
import { sendEmail, sendPlainEmail } from "@/lib/email";

// Webhooks have no signed-in user, so the kitchen is explicit.
const KITCHEN_ID = "kitchen_jwb";

// Every emailed invoice PDF goes to Beth, whoever sent the request.
// Set to null to send it back to the sender instead.
const SEND_INVOICES_TO: string | null = "yogabeth@mac.com";

const APP_URL = process.env.APP_URL || "https://meal-planner-pro-puce.vercel.app";

const LABELS: Record<string, string> = {
  pc: "Personal Chef Fee",
  "p.c.": "Personal Chef Fee",
  chef: "Personal Chef Fee",
  "personal chef": "Personal Chef Fee",
  gro: "Groceries",
  groc: "Groceries",
  grocery: "Groceries",
  groceries: "Groceries",
  del: "Delivery",
  delivery: "Delivery",
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const monthIndex = (word: string) => {
  const w = word.toLowerCase().replace(/\.$/, "");
  if (w.length < 3) return -1;
  return MONTHS.findIndex((m) => m.startsWith(w) || (w === "sept" && m === "september"));
};

// "November 3, 10, 17" / "Nov 11 and 16" / "Nov 28, Dec 2" / "11/3, 11/10"
// / "Dates: November 12". Returns null unless the whole line is dates.
export function parseCookDateLine(line: string): { month: number; day: number }[] | null {
  const rest = line.replace(/^(cook\s*)?dates?\s*[:\-–]?\s*/i, "");
  const tokens = rest
    .split(/\s*(?:,|&|\band\b|\s)\s*/i)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const out: { month: number; day: number }[] = [];
  let month = -1;
  for (const t of tokens) {
    const md = t.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (md) {
      month = Number(md[1]) - 1;
      out.push({ month, day: Number(md[2]) });
      continue;
    }
    const day = t.match(/^(\d{1,2})(st|nd|rd|th)?$/i);
    if (day) {
      if (month < 0) return null;
      out.push({ month, day: Number(day[1]) });
      continue;
    }
    const idx = monthIndex(t);
    if (idx < 0) return null;
    month = idx;
  }
  if (out.length === 0) return null;
  if (out.some((d) => d.month < 0 || d.month > 11 || d.day < 1 || d.day > 31)) return null;
  return out;
}

export type ParsedInvoiceBody = {
  lines: { description: string; amount: number }[];
  // Cook dates for a prepaid invoice; empty for a normal one.
  cookDates: { month: number; day: number }[];
  // Amount lines with no label ("1756"); only used for prepaid invoices.
  bareAmounts: number[];
  showGratuity: boolean;
  remarks: string | null;
  ignored: string[];
};

export function parseInvoiceBody(text: string): ParsedInvoiceBody {
  const lines: ParsedInvoiceBody["lines"] = [];
  const notes: string[] = [];
  const ignored: string[] = [];
  const cookDates: ParsedInvoiceBody["cookDates"] = [];
  const bareAmounts: number[] = [];
  let showGratuity = false;

  for (const raw of text.split(/\r?\n/)) {
    // Strip quote markers ("> PC: $425") from forwarded or quoted mail.
    const line = raw.replace(/^\s*(>\s?)+/, "").trim();
    if (!line) continue;

    // "Tip" (or "Gratuity", "Tip: yes") turns on the optional gratuity lines.
    if (/^(tips?|gratuity)\s*[:\-]?\s*(yes|y|on|please)?\s*[.!]?$/i.test(line)) {
      showGratuity = true;
      continue;
    }

    const note = line.match(/^(notes?|remarks?)\s*:\s*(.+)$/i);
    if (note) {
      notes.push(note[2].trim());
      continue;
    }

    // Checked before line items, or "November 12" would read as November: $12.
    const dates = parseCookDateLine(line);
    if (dates) {
      cookDates.push(...dates);
      continue;
    }

    const bare = line.match(/^\$?\s*([\d,]+(?:\.\d{1,2})?)$/);
    if (bare) {
      const amount = Number(bare[1].replace(/,/g, ""));
      if (amount > 0) {
        bareAmounts.push(amount);
        continue;
      }
    }

    // "PC: $425", "Gro $186.40", "Delivery - 25", "Credit: -$50", "Credit ($50)".
    const m = line.match(
      /^([A-Za-z][A-Za-z .&'/()-]*?)\s*[:\-–]?\s*(\(\s*\$?\s*[\d,]+(?:\.\d{1,2})?\s*\)|-?\s*\$?\s*-?\s*[\d,]+(?:\.\d{1,2})?)$/,
    );
    if (m) {
      const amtRaw = m[2];
      const negative = /^\(|-/.test(amtRaw.replace(/\s/g, ""));
      const amount = Number(amtRaw.replace(/[^\d.]/g, ""));
      const label = m[1].trim().replace(/[:\-–]+$/, "").trim();
      if (Number.isFinite(amount) && amount !== 0 && label) {
        lines.push({
          description: LABELS[label.toLowerCase()] ?? label,
          amount: negative ? -amount : amount,
        });
        continue;
      }
    }

    ignored.push(line);
  }

  return {
    lines,
    cookDates,
    bareAmounts,
    showGratuity,
    remarks: notes.length ? notes.join(" ") : null,
    ignored,
  };
}

// The invoice's line items. Normal invoice: the parsed lines. Prepaid: one line
// per cook date, the amount split evenly (leftover cents on the first dates).
// A date more than 60 days before the invoice date is taken as next year.
export function buildInvoiceLines(
  parsed: ParsedInvoiceBody,
  invoiceDate: Date,
): { description: string; amount: number }[] {
  if (parsed.cookDates.length === 0) {
    if (parsed.lines.length === 0) {
      throw new Error(
        `No line items found. Put one per line, like:\nPC: $425\nGro: $186.40\nTip`,
      );
    }
    return parsed.lines;
  }

  const total =
    parsed.lines.reduce((s, l) => s + l.amount, 0) +
    parsed.bareAmounts.reduce((s, a) => s + a, 0);
  if (!(total > 0)) {
    throw new Error(
      `Found cook dates but no amount. Put the total on its own line, like:\n1756\nNovember 3, 10, 17`,
    );
  }

  const cutoff = invoiceDate.getTime() - 60 * 24 * 60 * 60 * 1000;
  const seen = new Set<number>();
  const dates: Date[] = [];
  for (const { month, day } of parsed.cookDates) {
    let d = new Date(invoiceDate.getFullYear(), month, day, 12);
    if (d.getTime() < cutoff) d = new Date(invoiceDate.getFullYear() + 1, month, day, 12);
    if (d.getMonth() !== month) {
      throw new Error(`${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${day} is not a real date.`);
    }
    if (!seen.has(d.getTime())) {
      seen.add(d.getTime());
      dates.push(d);
    }
  }
  dates.sort((a, b) => a.getTime() - b.getTime());

  const cents = Math.round(total * 100);
  const base = Math.floor(cents / dates.length);
  const extra = cents - base * dates.length;
  return dates.map((d, i) => ({
    description: `Personal Chef – ${format(d, "EEEE, MMMM d")}`,
    amount: (base + (i < extra ? 1 : 0)) / 100,
  }));
}

type ClientRow = {
  id: string;
  firstName: string;
  lastName: string;
  address: string | null;
};

const nameTokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[\s,&/-]+/)
    // "Raphael's" matches Raphael.
    .map((t) => t.replace(/['’]s$/, "").replace(/[^a-z]/g, ""))
    .filter((t) => t && t !== "and");

// Exact shared names, order-insensitive. Returns the single best match, or an
// error when nothing matches or two clients tie.
export function matchClient(
  subjectClient: string,
  clients: ClientRow[],
): { client: ClientRow } | { error: string } {
  const wanted = new Set(nameTokens(subjectClient));
  const scored = clients
    .map((c) => {
      const have = new Set(nameTokens(`${c.firstName} ${c.lastName}`));
      let score = 0;
      for (const t of wanted) if (have.has(t)) score++;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const list = clients.map((c) => `  - ${c.firstName} ${c.lastName}`).join("\n");
  if (scored.length === 0) {
    return { error: `No client matches "${subjectClient}". Clients:\n${list}` };
  }
  if (scored.length > 1 && scored[0].score === scored[1].score) {
    const tied = scored
      .filter((x) => x.score === scored[0].score)
      .map((x) => `  - ${x.c.firstName} ${x.c.lastName}`)
      .join("\n");
    return {
      error: `"${subjectClient}" matches more than one client:\n${tied}\nPut a fuller name (e.g. the last name) in the subject.`,
    };
  }
  return { client: scored[0].c };
}

const money = (n: number) => (n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`);

export async function handleInboundInvoice(opts: {
  subject: string;
  body: string;
  senderEmail: string;
}): Promise<Record<string, unknown>> {
  const replyTo = process.env.REPLY_TO_EMAIL || "dennisjmccarthy@gmail.com";
  const to = SEND_INVOICES_TO ?? opts.senderEmail;

  try {
    const { client: subjectClient, date } = parseSubject(opts.subject);
    const parsed = parseInvoiceBody(opts.body);
    const lines = buildInvoiceLines(parsed, date);
    // An unlabeled amount only means something on a prepaid invoice.
    const ignored = parsed.cookDates.length
      ? parsed.ignored
      : [...parsed.ignored, ...parsed.bareAmounts.map((a) => String(a))];

    const clients = await prisma.client.findMany({
      where: { kitchenId: KITCHEN_ID, active: true },
      select: { id: true, firstName: true, lastName: true, address: true },
    });
    const match = matchClient(subjectClient, clients);
    if ("error" in match) throw new Error(match.error);
    const client = match.client;

    const total = lines.reduce((s, l) => s + l.amount, 0);

    // Guard against webhook re-deliveries: same client + date + total created
    // in the last 15 minutes means this email was already turned into an invoice.
    const recent = await prisma.invoice.findMany({
      where: {
        kitchenId: KITCHEN_ID,
        clientId: client.id,
        invoiceDate: date,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
      include: { lineItems: true },
    });
    let invoice = recent.find(
      (inv) => Math.abs(inv.lineItems.reduce((s, l) => s + l.amount, 0) - total) < 0.005,
    );
    const reused = Boolean(invoice);

    if (!invoice) {
      invoice = await prisma.invoice.create({
        data: {
          kitchenId: KITCHEN_ID,
          clientId: client.id,
          invoiceNumber: await getNextInvoiceNumber(),
          invoiceDate: date,
          remarks: parsed.remarks,
          showGratuity: parsed.showGratuity,
          lineItems: {
            create: lines.map((l, i) => ({ ...l, position: i + 1 })),
          },
        },
        include: { lineItems: true },
      });
    }

    const clientName = [client.firstName, client.lastName].filter(Boolean).join(" ");
    const items = [...invoice.lineItems].sort((a, b) => a.position - b.position);
    const html = buildInvoiceHtml({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: format(invoice.invoiceDate, "M/d/yyyy"),
      clientName,
      clientAddress: client.address,
      lineItems: items.map((li) => ({ description: li.description, amount: li.amount })),
      remarks: invoice.remarks,
      showGratuity: invoice.showGratuity,
    });
    const pdf = await generatePdfFromHtml(html);

    const link = `${APP_URL}/invoices/${invoice.id}`;
    const summary = [
      `Billed to: ${clientName}`,
      `Invoice #${invoice.invoiceNumber} · ${format(invoice.invoiceDate, "M/d/yyyy")}`,
      ``,
      ...items.map((li) => `${li.description}: ${money(li.amount)}`),
      invoice.showGratuity
        ? `Subtotal: ${money(total)} (with blank Optional Gratuity and Total lines)`
        : `Total: ${money(total)}`,
      ...(invoice.remarks ? [``, `Remarks: ${invoice.remarks}`] : []),
      ...(ignored.length
        ? [``, `Ignored these lines (not line items):`, ...ignored.map((l) => `  ${l}`)]
        : []),
      ``,
      reused
        ? `This email was already turned into invoice #${invoice.invoiceNumber}, so no new invoice was created.`
        : `Saved as a draft. Edit, send or delete it here:`,
      link,
    ];

    await sendEmail({
      to,
      replyTo,
      subject: `Invoice #${invoice.invoiceNumber} - ${clientName} - ${format(invoice.invoiceDate, "M/d/yyyy")}`,
      text: summary.join("\n"),
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;white-space:pre-wrap;">${summary
        .join("\n")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(link, `<a href="${link}">${link}</a>`)}</div>`,
      attachmentFilename: `${client.lastName.replace(/[^A-Za-z0-9]+/g, "_")}_Invoice_${invoice.invoiceNumber}.pdf`,
      attachmentPdf: pdf,
    });

    return { ok: true, kind: "invoice", invoiceNumber: invoice.invoiceNumber, reused };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    try {
      await sendPlainEmail({
        to: opts.senderEmail,
        subject: "Couldn't create your invoice",
        text: [
          `I couldn't create an invoice from your email.`,
          ``,
          `Reason: ${msg}`,
          ``,
          `Format: subject "Client Name - M/D/YYYY", and in the body one line per item:`,
          `PC: $425`,
          `Gro: $186.40`,
          `Tip   (only if you want the gratuity lines)`,
          ``,
          `Prepaid cook dates: subject "Invoice Client Name", and in the body:`,
          `1756`,
          `November 3, 10, 17`,
        ].join("\n"),
      });
    } catch {
      // ignore secondary failure
    }
    return { ok: false, kind: "invoice", error: msg };
  }
}
