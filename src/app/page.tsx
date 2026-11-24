import Link from "next/link";
import { DashboardView } from "@/components/dashboard-view";
import { MarketingPage } from "@/components/marketing-page";
import { PlanMenuButton } from "@/components/plan-menu-button";
import { StatCard } from "@/components/stat-card";
import { getKitchen } from "@/lib/data";
import {
  addDays,
  formatDayShort,
  formatWeekdayLong,
  formatWeekdayShort,
  monthRange,
  thisMonthKey,
  todayStart,
  todayYmd,
} from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { cookDaysFromLine, isChefLine } from "@/lib/invoice-cook-days";
import { prisma } from "@/lib/prisma";

type NeedsYouTone = "purple" | "green" | "blue" | "amber" | "orange";

type NeedsYouRow = {
  key: string;
  title: string;
  detail: string;
  action: string;
  href: string;
  tone: NeedsYouTone;
};

const TONE_CLASS: Record<NeedsYouTone, string> = {
  purple: "from-violet-400 to-fuchsia-600",
  green: "from-lime-400 to-emerald-600",
  blue: "from-sky-400 to-indigo-600",
  amber: "from-amber-400 to-red-500",
  orange: "from-orange-400 to-pink-600",
};

const TONE_ICON: Record<NeedsYouTone, string> = {
  // chat bubble: client answered
  purple:
    "M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z",
  // newspaper: Bon Appetit
  green:
    "M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6V7.5Z",
  // paper plane: invoice not sent
  blue: "M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5",
  // banknote: not marked paid
  amber:
    "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z",
  // clipboard: plan menu
  orange:
    "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z",
};

function clientName(c: { firstName: string; lastName: string }) {
  return `${c.firstName} ${c.lastName}`.trim();
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default async function Home() {
  // Signed out: marketing page. Signed in: the dashboard for their kitchen.
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
  const monthKey = thisMonthKey(now);
  const month = monthRange(monthKey)!;

  const [activeClients, allCookDates, openProposalCount, invoices, answeredMenus, paidThisMonth] =
    await Promise.all([
      prisma.client.findMany({
        where: { kitchenId: kitchen.id, active: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
      prisma.cookDate.findMany({
        where: { kitchenId: kitchen.id },
        include: {
          client: true,
          finalizedProposal: { select: { title: true } },
          proposals: { select: { id: true, status: true }, orderBy: { createdAt: "desc" } },
          _count: { select: { menuCards: true } },
        },
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.proposal.count({
        where: {
          kitchenId: kitchen.id,
          status: { in: ["DRAFT", "SENT", "REVISIONS_REQUESTED"] },
        },
      }),
      prisma.invoice.findMany({
        where: { kitchenId: kitchen.id, archivedAt: null },
        include: { client: true, lineItems: { select: { amount: true, description: true } } },
        orderBy: { invoiceDate: "desc" },
      }),
      prisma.proposal.findMany({
        where: {
          kitchenId: kitchen.id,
          status: "SENT",
          clientSubmittedAt: { not: null },
        },
        include: { cookDate: { include: { client: true } } },
        orderBy: { clientSubmittedAt: "desc" },
      }),
      // Same rule as the Money page: paid in a month = paidAt in that month;
      // older invoices marked paid before paidAt existed use their invoice date.
      prisma.invoice.findMany({
        where: {
          kitchenId: kitchen.id,
          status: "PAID",
          archivedAt: null,
          OR: [
            { paidAt: { gte: month.start, lt: month.end } },
            { paidAt: null, invoiceDate: { gte: month.start, lt: month.end } },
          ],
        },
        select: { paidAmount: true, lineItems: { select: { amount: true } } },
      }),
    ]);

  const invoiceTotal = (inv: { lineItems: { amount: number }[] }) =>
    inv.lineItems.reduce((s, li) => s + li.amount, 0);

  // Cooking days that are only on invoices (most of Beth's past cooks), for
  // the calendar. A day that already has a cook date for that client is
  // skipped, and each client/day shows once.
  const seenDays = new Set(allCookDates.map((cd) => `${cd.clientId}:${todayYmd(cd.scheduledFor)}`));
  const invoiceCooks = [];
  for (const inv of [...invoices].reverse()) {
    if (inv.status === "VOID") continue;
    for (const li of inv.lineItems) {
      if (!isChefLine(li.description)) continue;
      for (const ymd of cookDaysFromLine(li.description, inv.invoiceDate)) {
        const key = `${inv.clientId}:${ymd}`;
        if (seenDays.has(key)) continue;
        seenDays.add(key);
        invoiceCooks.push({
          id: `invoice-${inv.id}-${ymd}`,
          scheduledFor: `${ymd}T12:00:00`,
          startTimeLabel: null,
          guestCount: null,
          status: "COMPLETED",
          serviceNotes: null,
          clientName: clientName(inv.client),
          proposalTitle: null,
          href: `/invoices/${inv.id}`,
          invoiceNumber: inv.invoiceNumber,
        });
      }
    }
  }

  // ── Stat cards ──
  const upcomingCount = allCookDates.filter(
    (cd) => cd.scheduledFor >= start && cd.status !== "CANCELLED",
  ).length;
  const openInvoices = invoices.filter((inv) => inv.status === "DRAFT" || inv.status === "SENT");
  const notMarkedPaid = openInvoices.reduce((s, inv) => s + invoiceTotal(inv), 0);
  const paidThisMonthTotal = paidThisMonth.reduce(
    (s, inv) => s + (inv.paidAmount ?? invoiceTotal(inv)),
    0,
  );

  // Cook dates in the next 14 days (Needs you).
  const upcoming = allCookDates.filter(
    (cd) => cd.scheduledFor >= start && cd.scheduledFor < twoWeeksEnd && cd.status !== "CANCELLED",
  );
  const thisWeek = upcoming.filter((cd) => cd.scheduledFor < weekEnd);

  // Upcoming cook dates that already have a menu: "Plan a menu" opens it
  // instead of making a second cook date for the same client and day.
  const existingMenus = allCookDates
    .filter((cd) => cd.scheduledFor >= start && cd.status !== "CANCELLED")
    .flatMap((cd) => {
      const p = cd.proposals.find((x) => x.status !== "ARCHIVED");
      return p ? [{ clientId: cd.clientId, ymd: todayYmd(cd.scheduledFor), proposalId: p.id }] : [];
    });

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
      tone: "purple",
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
      tone: "green",
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
      tone: "blue",
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
      tone: "amber",
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
      tone: "orange",
    });
  }

  return (
    <div className="space-y-8 fade-up">
      {/* Top: title + the two things Beth starts most often */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)] opacity-80">
            {formatWeekdayLong(now)}
          </p>
          <h1 className="mt-1 page-title">Dashboard</h1>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <Link href="/newsletters" className="button-secondary flex-1 sm:flex-none lg:hidden">
            Newsletters
          </Link>
          <Link href="/recipes" className="button-secondary flex-1 sm:flex-none">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            Recipes
          </Link>
          <PlanMenuButton
            clients={activeClients}
            existing={existingMenus}
            today={todayYmd(now)}
            className="button-primary flex-1 px-6 sm:flex-none"
            label="+ Plan a menu"
          />
        </div>
      </header>

      <DashboardView
        cookDates={allCookDates.map((cd) => ({
          id: cd.id,
          scheduledFor: cd.scheduledFor.toISOString(),
          startTimeLabel: cd.startTimeLabel,
          guestCount: cd.guestCount,
          status: cd.status,
          serviceNotes: cd.serviceNotes,
          clientName: clientName(cd.client),
          proposalTitle: cd.finalizedProposal?.title ?? null,
        }))}
        invoices={invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate.toISOString(),
          status: inv.status,
          clientName: clientName(inv.client),
          total: invoiceTotal(inv),
        }))}
        clients={activeClients}
        invoiceCooks={invoiceCooks}
        initialMonth={Number(monthKey.slice(5, 7)) - 1}
        initialYear={Number(monthKey.slice(0, 4))}
        todayIso={start.toISOString()}
        belowCalendar={
          <>
          {/* Stats */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
            <StatCard
              value={activeClients.length}
              label="Clients"
              hint="Active client households"
              color="orange"
              icon="users"
              href="/clients"
            />
            <StatCard
              value={upcomingCount}
              label="Upcoming cook dates"
              hint="From today on, not cancelled"
              color="blue"
              icon="calendar"
              href="/cook-dates"
            />
            <StatCard
              value={openProposalCount}
              label="Open menus"
              hint="Drafts, sent, and changes requested"
              color="purple"
              icon="menu"
              href="/proposals"
            />
            <StatCard
              value={formatMoney(notMarkedPaid)}
              label="Not marked paid"
              hint={`${plural(openInvoices.length, "invoice")} · ${formatMoney(paidThisMonthTotal)} paid this month`}
              color="green"
              icon="dollar"
              href="/money"
            />
          </section>

          {/* Needs you */}
          <section aria-labelledby="needs-you" className="panel overflow-hidden">
            <div className="accent-hero flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-white shadow-md">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </div>
                <div>
                  <h2 id="needs-you" className="section-title">
                    Needs you
                  </h2>
                  <p className="text-sm text-slate-600">
                    {plural(thisWeek.length, "cook date")} this week · {formatMoney(notMarkedPaid)} not marked paid
                  </p>
                </div>
              </div>
              {rows.length > 0 && (
                <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-bold text-white shadow-sm">
                  {rows.length}
                </span>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-8 sm:px-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700">You&apos;re all caught up.</p>
              </div>
            ) : (
              <ul className="space-y-3 p-4 sm:p-5">
                {rows.map((row) => (
                  <li
                    key={row.key}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ${TONE_CLASS[row.tone]}`}
                      >
                        <svg aria-hidden="true" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d={TONE_ICON[row.tone]} />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{row.detail}</p>
                      </div>
                    </div>
                    <Link href={row.href} className="button-secondary shrink-0 self-start text-sm sm:self-auto">
                      {row.action}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </>
        }
      />
    </div>
  );
}
