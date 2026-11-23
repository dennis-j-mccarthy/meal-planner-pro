import Link from "next/link";
import { MarketingPage } from "@/components/marketing-page";
import { StatusBadge } from "@/components/status-badge";
import { getKitchen } from "@/lib/data";
import {
  addDays,
  formatDayShort,
  formatWeekdayLong,
  formatWeekdayShort,
  todayStart,
} from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type NeedsYouRow = {
  key: string;
  title: string;
  detail: string;
  action: string;
  href: string;
};

function clientName(c: { firstName: string; lastName: string }) {
  return `${c.firstName} ${c.lastName}`.trim();
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function Home() {
  // Signed out: marketing page. Signed in: Today for their kitchen.
  // (getKitchen, not requireKitchen: requireKitchen redirects to "/".)
  const kitchen = await getKitchen();
  if (!kitchen) {
    return <MarketingPage />;
  }

  const now = new Date();
  const start = todayStart(now);
  const weekEnd = addDays(start, 7); // today + the next 6 days
  const twoWeeksEnd = addDays(start, 15); // today + the next 14 days
  const draftCutoff = addDays(start, -60);
  const sentCutoff = addDays(now, -7);

  const [answeredMenus, upcoming, openInvoices] = await Promise.all([
    prisma.proposal.findMany({
      where: {
        kitchenId: kitchen.id,
        status: "SENT",
        clientSubmittedAt: { not: null },
      },
      include: { cookDate: { include: { client: true } } },
      orderBy: { clientSubmittedAt: "desc" },
    }),
    prisma.cookDate.findMany({
      where: {
        kitchenId: kitchen.id,
        scheduledFor: { gte: start, lt: twoWeeksEnd },
        status: { not: "CANCELLED" },
      },
      include: {
        client: true,
        proposals: { select: { status: true } },
        _count: { select: { menuCards: true } },
      },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.invoice.findMany({
      where: { kitchenId: kitchen.id, status: { in: ["DRAFT", "SENT"] } },
      include: { client: true, lineItems: { select: { amount: true } } },
      orderBy: { invoiceDate: "desc" },
    }),
  ]);

  const invoiceTotal = (inv: (typeof openInvoices)[number]) =>
    inv.lineItems.reduce((s, li) => s + li.amount, 0);

  const notMarkedPaid = openInvoices.reduce((s, inv) => s + invoiceTotal(inv), 0);
  const thisWeek = upcoming.filter((cd) => cd.scheduledFor < weekEnd);

  // ── Needs you ──
  const rows: NeedsYouRow[] = [];

  // a) Menus the client answered
  for (const p of answeredMenus) {
    const name = clientName(p.cookDate.client);
    rows.push({
      key: `answered-${p.id}`,
      title: `${name} answered the menu`,
      detail: `${p.clientApproved ? "Approved" : "Asked for changes"} · cook date ${formatWeekdayShort(p.cookDate.scheduledFor)}`,
      action: "Review",
      href: `/proposals/${p.id}`,
    });
  }

  // b) Approved menu, no Bon Appetit yet (next 14 days)
  const handledCookDates = new Set<string>();
  for (const cd of upcoming) {
    if (cd.status === "COMPLETED") continue;
    const approved =
      cd.status === "APPROVED" ||
      cd.finalizedProposalId !== null ||
      cd.proposals.some((p) => p.status === "APPROVED");
    if (!approved || cd._count.menuCards > 0) continue;
    handledCookDates.add(cd.id);
    rows.push({
      key: `ba-${cd.id}`,
      title: `${clientName(cd.client)} needs a Bon Appetit`,
      detail: `Menu approved · cook date ${formatWeekdayShort(cd.scheduledFor)}`,
      action: "Make Bon Appetit",
      href: `/cook-dates/${cd.id}`,
    });
  }

  // c) Invoices not sent yet (last 60 days)
  for (const inv of openInvoices) {
    if (inv.status !== "DRAFT" || inv.invoiceDate < draftCutoff) continue;
    rows.push({
      key: `draft-${inv.id}`,
      title: `Invoice #${inv.invoiceNumber} for ${clientName(inv.client)} is not sent`,
      detail: `${formatMoney(invoiceTotal(inv))} · dated ${formatDayShort(inv.invoiceDate)}`,
      action: "Open",
      href: `/invoices/${inv.id}`,
    });
  }

  // d) Sent more than 7 days ago and not marked paid
  for (const inv of openInvoices) {
    if (inv.status !== "SENT") continue;
    const sentOn = inv.sentAt ?? inv.invoiceDate;
    if (sentOn > sentCutoff) continue;
    rows.push({
      key: `unpaid-${inv.id}`,
      title: `Invoice #${inv.invoiceNumber} for ${clientName(inv.client)} is not marked paid`,
      detail: `${formatMoney(invoiceTotal(inv))} · sent ${formatDayShort(sentOn)}`,
      action: "Record payment",
      href: `/invoices/${inv.id}`,
    });
  }

  // e) Cook dates in the next 7 days with no menu at all
  for (const cd of thisWeek) {
    if (handledCookDates.has(cd.id) || cd.status === "COMPLETED") continue;
    if (cd.proposals.length > 0 || cd._count.menuCards > 0) continue;
    rows.push({
      key: `plan-${cd.id}`,
      title: `${clientName(cd.client)} has no menu yet`,
      detail: `Cook date ${formatWeekdayShort(cd.scheduledFor)}`,
      action: "Plan menu",
      href: `/cook-dates/${cd.id}`,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-12 fade-up">
      <header>
        <h1 className="page-title">{formatWeekdayLong(now)}</h1>
        <p className="mt-2 text-sm muted">
          {plural(thisWeek.length, "cook date")} this week · {formatMoney(notMarkedPaid)} not marked paid
        </p>
      </header>

      <section aria-labelledby="needs-you">
        <h2 id="needs-you" className="section-title">
          Needs you
        </h2>
        {rows.length === 0 ? (
          <p className="panel mt-4 px-5 py-8 text-center text-sm muted">
            You&apos;re all caught up.
          </p>
        ) : (
          <ul className="panel mt-4 divide-y divide-[var(--line)]">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{row.title}</p>
                  <p className="mt-1 text-sm muted">{row.detail}</p>
                </div>
                <Link href={row.href} className="button-secondary shrink-0 self-start sm:self-auto">
                  {row.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="this-week">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="this-week" className="section-title">
            This week
          </h2>
          <Link href="/cook-dates" className="text-sm font-medium text-[var(--accent-strong)] hover:underline">
            Calendar
          </Link>
        </div>
        {thisWeek.length === 0 ? (
          <p className="panel mt-4 px-5 py-8 text-center text-sm muted">
            No cook dates in the next 7 days.
          </p>
        ) : (
          <ul className="panel mt-4 divide-y divide-[var(--line)]">
            {thisWeek.map((cd) => (
              <li key={cd.id}>
                <Link
                  href={`/cook-dates/${cd.id}`}
                  className="flex min-h-14 items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--surface-raised)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {formatWeekdayShort(cd.scheduledFor)}
                      <span className="font-normal muted">
                        {cd.startTimeLabel ? ` · ${cd.startTimeLabel}` : ""}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-sm muted">{clientName(cd.client)}</p>
                  </div>
                  <StatusBadge status={cd.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
