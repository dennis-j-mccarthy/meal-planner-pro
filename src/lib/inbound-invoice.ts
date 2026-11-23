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
//             Travel: 30                     (optional: other labeled lines stay
//                                             their own line items)
//
// "Send: yes" on its own line also emails the PDF to the client.
// Replying "Paid Zelle" / "Paid check 1043" to the summary email records the
// payment (handleInboundPaymentReply).

import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseSubject } from "@/lib/bon-appetit-subject";
import { buildInvoiceHtml } from "@/lib/invoice-template";
import { generatePdfFromHtml } from "@/lib/generate-pdf";
import { createWithInvoiceNumber } from "@/lib/invoice-number";
import { sendEmail, sendPlainEmail } from "@/lib/email";
import { findOrCreateCookDate } from "@/lib/cook-date-match";
import { sendInvoiceToClient } from "@/lib/client-email";
import { recordPayment } from "@/lib/invoice-payment";
import {
  easternToday,
  firstNonEmptyLine,
  invoiceAddressFor,
  parsePaidLine,
  replyText,
  stripSendLine,
} from "@/lib/inbound-mail";

// Every emailed invoice PDF goes to Dennis, whoever sent the request.
// Set to "yogabeth@mac.com" for Beth, or null to reply to the sender.
// The Monday summary email goes here too.
export const SEND_INVOICES_TO: string | null = "dennisjmccarthy@gmail.com";

export const APP_URL = process.env.APP_URL || "https://meal-planner-pro-puce.vercel.app";

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

// The prepaid cook dates as real dates, sorted and de-duplicated. A date more
// than 60 days before the invoice date is taken as next year.
export function resolveCookDates(parsed: ParsedInvoiceBody, invoiceDate: Date): Date[] {
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
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

// The invoice's line items. Normal invoice: the parsed lines. Prepaid: one line
// per cook date, the amount split evenly (leftover cents on the first dates),
// then any other labeled lines (Travel, Groceries...) as their own items.
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

  // The amount to split: unlabeled ("1756") or labeled PC / Prepay / Total.
  const isSplit = (l: { description: string }) =>
    l.description === "Personal Chef Fee" || /^(prepa(y|id)|total|amount)$/i.test(l.description);
  const extras = parsed.lines.filter((l) => !isSplit(l));
  const total =
    parsed.lines.filter(isSplit).reduce((s, l) => s + l.amount, 0) +
    parsed.bareAmounts.reduce((s, a) => s + a, 0);
  if (!(total > 0)) {
    throw new Error(
      `Found cook dates but no amount. Put the total on its own line, like:\n1756\nNovember 3, 10, 17`,
    );
  }

  const dates = resolveCookDates(parsed, invoiceDate);

  const cents = Math.round(total * 100);
  const base = Math.floor(cents / dates.length);
  const extra = cents - base * dates.length;
  return [
    ...dates.map((d, i) => ({
      description: `Personal Chef – ${format(d, "EEEE, MMMM d")}`,
      amount: (base + (i < extra ? 1 : 0)) / 100,
    })),
    ...extras,
  ];
}

type ClientRow = {
  id: string;
  firstName: string;
  lastName: string;
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
export function matchClient<T extends ClientRow>(
  subjectClient: string,
  clients: T[],
): { client: T } | { error: string } {
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

const money = (n: number) => {
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${s}` : `$${s}`;
};

export async function handleInboundInvoice(opts: {
  subject: string;
  body: string;
  senderEmail: string;
  kitchenId: string;
}): Promise<Record<string, unknown>> {
  const { kitchenId } = opts;
  // Replies to the summary come back to invoice@, where "Paid Zelle" is recorded.
  const replyTo = invoiceAddressFor(kitchenId);
  const to = SEND_INVOICES_TO ?? opts.senderEmail;

  try {
    const kitchen = await prisma.kitchen.findUnique({ where: { id: kitchenId } });
    if (!kitchen) throw new Error(`Kitchen ${kitchenId} not found`);

    const { client: subjectClient, date, dated, monthOnly } = parseSubject(opts.subject);
    const { body, send: sendToClient } = stripSendLine(opts.body);
    const parsed = parseInvoiceBody(body);
    const lines = buildInvoiceLines(parsed, date);
    const prepaidDates = resolveCookDates(parsed, date);
    // An unlabeled amount only means something on a prepaid invoice.
    const ignored = parsed.cookDates.length
      ? parsed.ignored
      : [...parsed.ignored, ...parsed.bareAmounts.map((a) => String(a))];

    const clients = await prisma.client.findMany({
      where: { kitchenId, active: true },
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
        kitchenId,
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
      // Link to cook dates. One-off invoice with a date in the subject: that
      // day's cook date (created as completed if missing). Prepaid: make sure
      // each listed date is on the calendar, and record the billing month.
      let cookDateId: string | null = null;
      let billingPeriod: string | null = null;
      if (prepaidDates.length > 0) {
        for (const d of prepaidDates) {
          await findOrCreateCookDate({ kitchenId, clientId: client.id, date: d, status: "APPROVED" });
        }
        billingPeriod = format(prepaidDates[0], "yyyy-MM");
      } else if (dated && !monthOnly) {
        cookDateId = (
          await findOrCreateCookDate({ kitchenId, clientId: client.id, date, status: date.getTime() > Date.now() ? "APPROVED" : "COMPLETED" })
        ).id;
      }

      invoice = await createWithInvoiceNumber(kitchenId, (invoiceNumber) => prisma.invoice.create({
        data: {
          kitchenId,
          clientId: client.id,
          invoiceNumber,
          invoiceDate: date,
          cookDateId,
          billingPeriod,
          remarks: parsed.remarks,
          showGratuity: parsed.showGratuity,
          lineItems: {
            create: lines.map((l, i) => ({ ...l, position: i + 1 })),
          },
        },
        include: { lineItems: true },
      }));
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

    // "Send: yes" → also email the client (not again on a re-delivered email).
    let clientNote: string | null = null;
    let sentToClient = false;
    if (sendToClient) {
      if (reused) {
        clientNote = `Not sent to the client again (this email was already handled).`;
      } else {
        const sent = await sendInvoiceToClient(invoice.id, kitchen, { pdf });
        sentToClient = sent.ok;
        clientNote = sent.ok
          ? `Sent to the client: ${sent.to}${kitchen.contactEmail ? ` (cc ${kitchen.contactEmail})` : ""}. Marked as sent.`
          : `Not sent to the client: ${sent.error}.`;
      }
    }

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
      ...(clientNote ? [``, clientNote] : []),
      ``,
      reused
        ? `This email was already turned into invoice #${invoice.invoiceNumber}, so no new invoice was created.`
        : sentToClient
          ? `Edit or delete it here:`
          : `Saved as a draft. Edit, send or delete it here:`,
      link,
      ``,
      `When it's paid, reply to this email with just: Paid Zelle — or — Paid check 1043`,
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
          `Travel: 30   (optional)`,
        ].join("\n"),
      });
    } catch {
      // ignore secondary failure
    }
    return { ok: false, kind: "invoice", error: msg };
  }
}

// A reply to an invoice summary ("Re: Invoice #11-1043 - ..."). Records a
// payment from "Paid Zelle" / "Paid check 1043"; anything else gets help text.
// Never creates an invoice.
export async function handleInboundPaymentReply(opts: {
  invoiceNumber: string;
  subject: string;
  body: string;
  senderEmail: string;
  kitchenId: string;
}): Promise<Record<string, unknown>> {
  const { invoiceNumber, kitchenId } = opts;
  const subject = `Re: ${opts.subject.replace(/^((re|fwd?)\s*:\s*)+/i, "")}`;
  const help = `To record a payment, reply with just: Paid Zelle — or — Paid check 1043`;
  const reply = (text: string) =>
    sendPlainEmail({ to: opts.senderEmail, replyTo: invoiceAddressFor(kitchenId), subject, text });

  try {
    const line = firstNonEmptyLine(replyText(opts.body));
    const paid = line ? parsePaidLine(line) : null;
    if (!paid) {
      await reply(help);
      return { ok: true, kind: "payment-reply", invoiceNumber, recorded: false, reason: "not a paid line" };
    }

    const result = await recordPayment({
      kitchenId,
      invoiceNumber,
      method: paid.method,
      note: paid.note,
    });
    if (result.ok) {
      await reply(`Recorded: invoice #${invoiceNumber} paid by ${result.method} on ${easternToday()}.`);
      return { ok: true, kind: "payment-reply", invoiceNumber, recorded: true, method: result.method };
    }

    const text =
      result.reason === "already-paid"
        ? `Invoice #${invoiceNumber} is already marked paid${result.paidMethod ? ` by ${result.paidMethod}` : ""}${
            result.paidAt
              ? ` on ${result.paidAt.toLocaleDateString("en-US", { timeZone: "America/New_York" })}`
              : ""
          }. Nothing changed.`
        : result.reason === "void"
          ? `Invoice #${invoiceNumber} is void, so no payment was recorded.`
          : `Couldn't find invoice #${invoiceNumber}, so no payment was recorded.`;
    await reply(text);
    return { ok: true, kind: "payment-reply", invoiceNumber, recorded: false, reason: result.reason };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    try {
      await reply(`I couldn't record the payment for invoice #${invoiceNumber}.\n\nReason: ${msg}`);
    } catch {
      // ignore secondary failure
    }
    return { ok: false, kind: "payment-reply", invoiceNumber, error: msg };
  }
}
