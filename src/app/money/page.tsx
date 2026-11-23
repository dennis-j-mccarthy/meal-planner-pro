import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { UnpaidInvoiceList } from "@/components/unpaid-invoice-list";
import {
  formatDayShort,
  formatMonthKey,
  monthRange,
  shiftMonthKey,
  thisMonthKey,
  todayYmd,
} from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

type PaidRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  paidAt: Date | null;
  paidMethod: string | null;
  paidAmount: number | null;
  client: { firstName: string; lastName: string };
  lineItems: { amount: number }[];
};

function paidTotal(inv: PaidRow) {
  return inv.paidAmount ?? inv.lineItems.reduce((s, li) => s + li.amount, 0);
}

// Paid in a month = paidAt in that month. Older invoices marked paid before
// paidAt was recorded fall back to their invoice date.
function paidInRange(kitchenId: string, start: Date, end: Date) {
  return prisma.invoice.findMany({
    where: {
      kitchenId,
      status: "PAID",
      OR: [
        { paidAt: { gte: start, lt: end } },
        { paidAt: null, invoiceDate: { gte: start, lt: end } },
      ],
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      lineItems: { select: { amount: true } },
    },
    orderBy: [{ paidAt: { sort: "desc", nulls: "last" } }, { invoiceDate: "desc" }],
  });
}

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const kitchen = await requireKitchen();
  const params = await searchParams;

  const currentMonth = thisMonthKey();
  const month = params.month && monthRange(params.month) ? params.month : currentMonth;
  const selected = monthRange(month)!;
  const current = monthRange(currentMonth)!;

  const [unpaid, paidSelected, paidThisMonth] = await Promise.all([
    prisma.invoice.findMany({
      where: { kitchenId: kitchen.id, status: { in: ["DRAFT", "SENT"] } },
      include: {
        client: { select: { firstName: true, lastName: true } },
        lineItems: { select: { amount: true } },
      },
      orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    }),
    paidInRange(kitchen.id, selected.start, selected.end),
    month === currentMonth
      ? null
      : paidInRange(kitchen.id, current.start, current.end),
  ]);

  const unpaidRows = unpaid.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: `${inv.client.firstName} ${inv.client.lastName}`.trim(),
    dateLabel: formatDayShort(inv.invoiceDate),
    status: inv.status,
    total: inv.lineItems.reduce((s, li) => s + li.amount, 0),
  }));
  const unpaidTotal = unpaidRows.reduce((s, r) => s + r.total, 0);
  const paidThisMonthTotal = (paidThisMonth ?? paidSelected).reduce(
    (s, inv) => s + paidTotal(inv),
    0,
  );
  const paidSelectedTotal = paidSelected.reduce((s, inv) => s + paidTotal(inv), 0);

  const prev = shiftMonthKey(month, -1);
  const next = shiftMonthKey(month, 1);
  const nextIsFuture = next > currentMonth;

  return (
    <div className="mx-auto max-w-4xl space-y-12 fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Money</h1>
          <p className="mt-2 text-sm muted">Invoices not marked paid, and what came in.</p>
        </div>
        <Link href="/invoices" className="button-secondary">
          All invoices
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Summary">
        <div className="panel px-5 py-5">
          <p className="text-sm muted">Not marked paid</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink">
            {formatMoney(unpaidTotal)}
          </p>
          <p className="mt-1 text-sm muted">
            {unpaidRows.length} invoice{unpaidRows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="panel px-5 py-5">
          <p className="text-sm muted">Paid this month</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink">
            {formatMoney(paidThisMonthTotal)}
          </p>
          <p className="mt-1 text-sm muted">{formatMonthKey(currentMonth)}</p>
        </div>
      </section>

      <section aria-labelledby="not-marked-paid">
        <h2 id="not-marked-paid" className="section-title">
          Not marked paid
        </h2>
        <p className="mt-1 text-sm muted">
          Tick the invoices that were paid, then choose how and when.
        </p>
        <div className="mt-4">
          <UnpaidInvoiceList invoices={unpaidRows} today={todayYmd()} />
        </div>
      </section>

      <section aria-labelledby="paid">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="paid" className="section-title">
            Paid
          </h2>
          <nav aria-label="Month" className="flex items-center gap-2">
            <Link
              href={`/money?month=${prev}`}
              className="button-secondary px-3"
              aria-label={`Previous month, ${formatMonthKey(prev)}`}
            >
              ‹
            </Link>
            <span className="min-w-36 text-center text-sm font-semibold text-ink">
              {formatMonthKey(month)}
            </span>
            {nextIsFuture ? (
              <span className="button-secondary px-3 opacity-40" aria-hidden="true">
                ›
              </span>
            ) : (
              <Link
                href={`/money?month=${next}`}
                className="button-secondary px-3"
                aria-label={`Next month, ${formatMonthKey(next)}`}
              >
                ›
              </Link>
            )}
          </nav>
        </div>

        {paidSelected.length === 0 ? (
          <p className="panel mt-4 px-5 py-8 text-center text-sm muted">
            Nothing marked paid in {formatMonthKey(month)}.
          </p>
        ) : (
          <>
            <ul className="panel mt-4 divide-y divide-[var(--line)]">
              {paidSelected.map((inv) => (
                <li key={inv.id}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="flex min-h-14 items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--surface-raised)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {inv.client.firstName} {inv.client.lastName}
                        <span className="font-normal muted"> · #{inv.invoiceNumber}</span>
                      </p>
                      <p className="mt-1 text-sm muted">
                        {inv.paidMethod ?? "Method not recorded"} ·{" "}
                        {inv.paidAt
                          ? `paid ${formatDayShort(inv.paidAt)}`
                          : `invoice dated ${formatDayShort(inv.invoiceDate)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-ink">
                        {formatMoney(paidTotal(inv))}
                      </span>
                      <span className="hidden sm:inline-flex">
                        <StatusBadge status="PAID" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right text-sm muted">
              Total for {formatMonthKey(month)}:{" "}
              <span className="font-semibold text-ink">{formatMoney(paidSelectedTotal)}</span>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
