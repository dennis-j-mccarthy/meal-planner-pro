// Monday money email (Vercel Cron, "0 12 * * 1" in vercel.json): what isn't
// marked paid, this week's cook dates, proposals waiting on clients, and
// approved cook dates with no Bon Appetit yet. Beth's kitchen only.
//
// Auth: with CRON_SECRET set, requires "Authorization: Bearer <secret>"
// (Vercel Cron sends this). Without it, requires the vercel-cron user-agent.
// ?dry=1 returns the rendered email as JSON instead of sending it.
import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { sendPlainEmail } from "@/lib/email";
import { formatMoney } from "@/lib/format";
import { APP_URL, SEND_INVOICES_TO } from "@/lib/inbound-invoice";
import { LIVE_KITCHEN_ID, escapeHtml } from "@/lib/inbound-mail";

const DAY_MS = 24 * 60 * 60 * 1000;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return (req.headers.get("user-agent") ?? "").includes("vercel-cron");
}

type Item = { text: string; link: string };
type Section = { title: string; items: Item[]; footer?: string; empty: string };

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  const kitchenId = LIVE_KITCHEN_ID;
  const kitchen = await prisma.kitchen.findUnique({ where: { id: kitchenId } });
  if (!kitchen) {
    return NextResponse.json({ error: "Kitchen not found" }, { status: 500 });
  }

  const now = new Date();
  // Cook dates are stored at midday; starting 12h back keeps today's in.
  const weekStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);

  const [unpaid, cookDates, waiting, noBonAppetit] = await Promise.all([
    // 1. Not marked paid: draft or sent, dated in the last 60 days.
    prisma.invoice.findMany({
      where: {
        kitchenId,
        status: { in: ["DRAFT", "SENT"] },
        archivedAt: null,
        invoiceDate: { gte: new Date(now.getTime() - 60 * DAY_MS) },
      },
      include: { client: true, lineItems: { select: { amount: true } } },
      orderBy: { invoiceDate: "asc" },
    }),
    // 2. This week's cook dates.
    prisma.cookDate.findMany({
      where: {
        kitchenId,
        status: { not: "CANCELLED" },
        scheduledFor: { gte: weekStart, lt: weekEnd },
      },
      include: { client: true },
      orderBy: { scheduledFor: "asc" },
    }),
    // 3. Proposals sent to clients with no answer yet.
    prisma.proposal.findMany({
      where: { kitchenId, status: "SENT", clientSubmittedAt: null },
      include: { cookDate: { include: { client: true } } },
      orderBy: { sentAt: "asc" },
    }),
    // 4. Upcoming cook dates that are approved (or have an approved meal plan)
    // but have no Bon Appetit yet.
    prisma.cookDate.findMany({
      where: {
        kitchenId,
        scheduledFor: { gte: weekStart },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        menuCards: { none: {} },
        OR: [
          { status: "APPROVED" },
          { finalizedProposalId: { not: null } },
          { proposals: { some: { status: "APPROVED" } } },
        ],
      },
      include: { client: true },
      orderBy: { scheduledFor: "asc" },
    }),
  ]);

  const name = (c: { firstName: string; lastName: string }) =>
    [c.firstName, c.lastName].filter(Boolean).join(" ");
  const invoiceTotal = (inv: (typeof unpaid)[number]) =>
    inv.lineItems.reduce((s, li) => s + li.amount, 0);
  const unpaidTotal = unpaid.reduce((s, inv) => s + invoiceTotal(inv), 0);
  const days = (d: Date) => {
    const n = Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY_MS));
    return `${n} day${n === 1 ? "" : "s"}`;
  };

  const sections: Section[] = [
    {
      title: "Not marked paid",
      items: unpaid.map((inv) => ({
        text: `${name(inv.client)} · #${inv.invoiceNumber} · ${formatMoney(invoiceTotal(inv))} · ${days(inv.invoiceDate)}`,
        link: `${APP_URL}/invoices/${inv.id}`,
      })),
      footer: unpaid.length ? `Total: ${formatMoney(unpaidTotal)}` : undefined,
      empty: "Everything from the last 60 days is marked paid.",
    },
    {
      title: "This week",
      items: cookDates.map((cd) => ({
        text: `${format(cd.scheduledFor, "EEE M/d")} · ${name(cd.client)}${cd.startTimeLabel ? ` · ${cd.startTimeLabel}` : ""}`,
        link: `${APP_URL}/cook-dates/${cd.id}`,
      })),
      empty: "No cook dates in the next 7 days.",
    },
    {
      title: "Waiting on clients",
      items: waiting.map((p) => ({
        text: `${name(p.cookDate.client)} · ${p.title}${p.sentAt ? ` · sent ${format(p.sentAt, "M/d")}` : ""}`,
        link: `${APP_URL}/proposals/${p.id}`,
      })),
      empty: "No proposals waiting on a client.",
    },
    {
      title: "Approved, no Bon Appetit yet",
      items: noBonAppetit.map((cd) => ({
        text: `${format(cd.scheduledFor, "EEE M/d")} · ${name(cd.client)}`,
        link: `${APP_URL}/cook-dates/${cd.id}`,
      })),
      empty: "None.",
    },
  ];

  const subject = `This week: ${formatMoney(unpaidTotal)} not marked paid · ${cookDates.length} cook date${cookDates.length === 1 ? "" : "s"}`;

  const text = sections
    .map((s) =>
      [
        s.title,
        ...(s.items.length
          ? s.items.map((it) => `  - ${it.text}\n    ${it.link}`)
          : [`  ${s.empty}`]),
        ...(s.footer ? [`  ${s.footer}`] : []),
      ].join("\n"),
    )
    .join("\n\n");

  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">${sections
    .map(
      (s) =>
        `<h3 style="margin:20px 0 6px;font-size:16px;">${escapeHtml(s.title)}</h3>` +
        (s.items.length
          ? `<ul style="margin:0;padding-left:20px;">${s.items
              .map(
                (it) =>
                  `<li style="margin:2px 0;"><a href="${escapeHtml(it.link)}" style="color:#1f2937;">${escapeHtml(it.text)}</a></li>`,
              )
              .join("")}</ul>`
          : `<p style="margin:0;color:#6b7280;">${escapeHtml(s.empty)}</p>`) +
        (s.footer ? `<p style="margin:6px 0 0;font-weight:600;">${escapeHtml(s.footer)}</p>` : ""),
    )
    .join("")}</div>`;

  const to = SEND_INVOICES_TO ?? kitchen.contactEmail;
  if (dry) {
    return NextResponse.json({ ok: true, dry: true, to, subject, text });
  }
  if (!to) {
    return NextResponse.json({ error: "No address to send the summary to" }, { status: 500 });
  }

  // A reply goes to a person, not back into the menu@/invoice@ webhook.
  await sendPlainEmail({
    to,
    replyTo: process.env.REPLY_TO_EMAIL || "dennisjmccarthy@gmail.com",
    subject,
    text,
    html,
  });
  return NextResponse.json({ ok: true, to, subject });
}
