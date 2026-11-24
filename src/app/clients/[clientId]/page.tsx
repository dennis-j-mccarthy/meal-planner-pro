import Link from "next/link";
import { notFound } from "next/navigation";
import { createInvoiceForCookDate, createMonthlyInvoice } from "@/app/billing-actions";
import { EditClientModal } from "@/components/edit-client-modal";
import { StatusBadge } from "@/components/status-badge";
import { formatDateShort, formatDateLong, formatMoney } from "@/lib/format";
import { parsePreferenceList } from "@/lib/preference-options";
import { parseDishQuota, totalDishes } from "@/lib/dish-quota";
import { requireKitchen } from "@/lib/guard";
import { cookDatesForMonth, findMonthlyInvoice } from "@/lib/billing";
import {
  BILLING_MODE_LABEL,
  isMonthlyBilling,
  normalizeBillingMode,
} from "@/lib/cook-date-progress";
import {
  addDays,
  formatMonthKey,
  formatWeekdayLong,
  formatWeekdayShort,
  monthRange,
  shiftMonthKey,
  thisMonthKey,
  todayStart,
} from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ billMonth?: string }>;
}) {
  const { clientId } = await params;
  const { billMonth } = await searchParams;
  const kitchen = await requireKitchen();

  const client = await prisma.client.findFirst({
    where: { id: clientId, kitchenId: kitchen.id },
    include: {
      cookDates: {
        include: {
          finalizedProposal: true,
          proposals: { select: { id: true, status: true } },
          menuCards: { select: { id: true, title: true } },
        },
        orderBy: { scheduledFor: "desc" },
      },
      invoices: {
        where: { archivedAt: null },
        include: {
          lineItems: { orderBy: { position: "asc" } },
        },
        orderBy: { invoiceDate: "desc" },
      },
      menuCards: {
        where: { cookDateId: null },
        include: {
          recipes: {
            include: { recipe: { select: { title: true } } },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { menuDate: "desc" },
      },
    },
  });

  if (!client) notFound();

  const now = new Date();
  const upcomingCookDates = client.cookDates.filter(
    (cd) => cd.scheduledFor >= now,
  );
  const pastCookDates = client.cookDates.filter(
    (cd) => cd.scheduledFor < now,
  );

  // Invoices not linked to cook dates
  const standaloneInvoices = client.invoices;

  // ── Billing ──
  const billingMode = normalizeBillingMode(client.billingMode);
  const monthly = isMonthlyBilling(billingMode);
  const billingSummary = [
    BILLING_MODE_LABEL[billingMode],
    client.defaultRate != null ? `${formatMoney(client.defaultRate)} per cook date` : "No rate set",
    client.travelFee ? `Travel ${formatMoney(client.travelFee)}` : null,
  ].filter(Boolean);

  const cookDateById = new Map(client.cookDates.map((cd) => [cd.id, cd]));
  const invoicedCookDateIds = new Set(
    client.invoices.filter((inv) => inv.status !== "VOID" && inv.cookDateId).map((inv) => inv.cookDateId),
  );

  // "+ New invoice": recent and upcoming cook dates that have no invoice yet.
  const todayWindow = todayStart(now);
  const invoiceableCookDates = client.cookDates
    .filter(
      (cd) =>
        cd.status !== "CANCELLED" &&
        !invoicedCookDateIds.has(cd.id) &&
        cd.scheduledFor >= addDays(todayWindow, -120) &&
        cd.scheduledFor < addDays(todayWindow, 60),
    )
    .slice(0, 8);

  // "Bill the month": monthly-ahead bills this month (next month once this
  // month has its invoice); monthly-after bills the month that just ended.
  const currentMonth = thisMonthKey(now);
  let defaultBillMonth = currentMonth;
  if (billingMode === "MONTHLY_AFTER") {
    defaultBillMonth = shiftMonthKey(currentMonth, -1);
  } else if (billingMode === "MONTHLY_AHEAD") {
    const thisMonthInvoice = await findMonthlyInvoice(kitchen.id, client.id, currentMonth);
    if (thisMonthInvoice) defaultBillMonth = shiftMonthKey(currentMonth, 1);
  }
  const selectedBillMonth = billMonth && monthRange(billMonth) ? billMonth : defaultBillMonth;
  const monthOptions = Array.from({ length: 10 }, (_, i) => shiftMonthKey(currentMonth, 3 - i));
  if (!monthOptions.includes(selectedBillMonth)) monthOptions.push(selectedBillMonth);
  const [billPreview, existingMonthInvoice] = await Promise.all([
    cookDatesForMonth(kitchen.id, client.id, selectedBillMonth),
    findMonthlyInvoice(kitchen.id, client.id, selectedBillMonth),
  ]);
  const billCount = billPreview?.included.length ?? 0;
  const billTotal =
    billCount * (client.defaultRate ?? 0) + (client.travelFee ? client.travelFee * billCount : 0);
  const selectedMonthLabel = formatMonthKey(selectedBillMonth);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/clients" className="hover:text-slate-900">
          Clients
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">
          {client.firstName} {client.lastName}
        </span>
      </div>

      {/* Client header */}
      <div className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="page-title">
              {client.firstName} {client.lastName}
            </h1>
            {client.householdLabel && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {client.householdLabel}
              </p>
            )}
            <div className="mt-2 space-y-0.5 text-sm text-slate-500">
              {client.email && <p>{client.email}</p>}
              {client.secondaryEmail && <p>{client.secondaryEmail}</p>}
              {client.phone && <p>{client.phone}</p>}
              {client.address && (
                <p className="whitespace-pre-line">{client.address}</p>
              )}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Billing:</span>{" "}
              {billingSummary.join(" · ")}
            </p>
            {client.dietaryNotes && (
              <p className="mt-3 text-sm text-slate-600">
                {client.dietaryNotes}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex items-center gap-3">
              <StatusBadge status={client.active ? "ACTIVE" : "INACTIVE"} />
              <EditClientModal
                client={{
                  id: client.id,
                  firstName: client.firstName,
                  lastName: client.lastName,
                  email: client.email,
                  secondaryEmail: client.secondaryEmail,
                  phone: client.phone,
                  householdLabel: client.householdLabel,
                  dietaryNotes: client.dietaryNotes,
                  inclusions: client.inclusions,
                  exclusions: client.exclusions,
                  profileNotes: client.profileNotes,
                  dishQuota: client.dishQuota,
                  street: client.street,
                  city: client.city,
                  state: client.state,
                  zip: client.zip,
                  billingMode: client.billingMode,
                  defaultRate: client.defaultRate,
                  travelFee: client.travelFee,
                }}
              />
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>{client.cookDates.length} cook date{client.cookDates.length !== 1 ? "s" : ""}</p>
              <p>{client.invoices.length} invoice{client.invoices.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences profile */}
      {(client.inclusions || client.exclusions || client.profileNotes) && (
        <div className="panel p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Preferences
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {client.inclusions && (
              <div>
                <p className="text-xs font-semibold text-emerald-600">Inclusions</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {parsePreferenceList(client.inclusions).map((item) => (
                    <span
                      key={item}
                      className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {client.exclusions && (
              <div>
                <p className="text-xs font-semibold text-red-600">Exclusions</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {parsePreferenceList(client.exclusions).map((item) => (
                    <span
                      key={item}
                      className="inline-block rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {client.profileNotes && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500">Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {client.profileNotes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Dish plan */}
      {(() => {
        const quota = parseDishQuota(client.dishQuota);
        if (quota.length === 0) return null;
        return (
          <div className="panel p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Dish plan
              </h2>
              <span className="text-xs text-slate-400">
                {totalDishes(quota)} dish{totalDishes(quota) !== 1 ? "es" : ""} per menu
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {quota.map((row) => (
                <span
                  key={row.category}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm"
                >
                  <span className="font-bold text-slate-900">{row.count}</span>
                  <span className="text-slate-600">{row.category}</span>
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/cook-dates?clientId=${client.id}#new-cook-date`}
          className="button-primary text-sm"
        >
          + New cook date
        </Link>
        <details className="relative">
          <summary className="button-secondary text-sm list-none [&::-webkit-details-marker]:hidden">
            + New invoice
          </summary>
          <div className="absolute left-0 z-20 mt-2 w-80 max-w-[calc(100vw_-_2rem)] panel p-3 shadow-lg">
            {invoiceableCookDates.length > 0 ? (
              <>
                <p className="px-2 pb-2 text-xs font-semibold text-slate-500">
                  Invoice a cook date
                </p>
                <ul className="space-y-1">
                  {invoiceableCookDates.map((cd) => (
                    <li key={cd.id}>
                      <form action={createInvoiceForCookDate.bind(null, cd.id)}>
                        <button className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm text-slate-800 hover:bg-[var(--surface-raised)]">
                          <span>{formatWeekdayLong(cd.scheduledFor)}</span>
                          <StatusBadge status={cd.status} />
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="px-2 pb-2 text-sm text-slate-500">
                No recent cook dates without an invoice.
              </p>
            )}
            <Link
              href={`/invoices?clientId=${client.id}`}
              className="mt-2 flex min-h-11 items-center rounded-lg border-t border-[var(--line)] px-2 pt-2 text-sm font-medium text-[var(--accent-strong)] hover:underline"
            >
              Invoice without a cook date
            </Link>
          </div>
        </details>
        <Link
          href={`/menu-cards?clientId=${client.id}`}
          className="button-secondary text-sm"
        >
          + New Bon Appetit
        </Link>
      </div>

      {/* Bill the month */}
      <section aria-labelledby="bill-month" className="panel p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="bill-month" className="section-title">
              Bill the month
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {monthly
                ? `${client.firstName} is billed ${billingMode === "MONTHLY_AHEAD" ? "monthly, paid ahead" : "monthly, paid after"}: one invoice for all cook dates in the month.`
                : "One invoice for all cook dates in a month."}
            </p>
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2">
            <label htmlFor="billMonth" className="sr-only">
              Month
            </label>
            <select
              id="billMonth"
              name="billMonth"
              defaultValue={selectedBillMonth}
              className="field w-auto!"
            >
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {formatMonthKey(key)}
                </option>
              ))}
            </select>
            <button className="button-secondary">Show</button>
          </form>
        </div>

        <div className="mt-5 border-t border-[var(--line)] pt-4">
          {billCount > 0 ? (
            <ul className="space-y-1.5 text-sm text-slate-700">
              {billPreview!.included.map((cd) => (
                <li key={cd.id} className="flex justify-between gap-4">
                  <span>{formatWeekdayShort(cd.scheduledFor)}{cd.startTimeLabel ? ` · ${cd.startTimeLabel}` : ""}</span>
                  <span className="text-slate-500">{client.defaultRate != null ? formatMoney(client.defaultRate) : "Rate not set"}</span>
                </li>
              ))}
              {client.travelFee ? (
                <li className="flex justify-between gap-4">
                  <span>Travel × {billCount}</span>
                  <span className="text-slate-500">{formatMoney(client.travelFee * billCount)}</span>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              No cook dates to bill in {selectedMonthLabel}.
            </p>
          )}
          {billPreview && billPreview.alreadyInvoiced.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-500">
              {billPreview.alreadyInvoiced.map(({ cookDate: cd, invoice: inv }) => (
                <li key={cd.id}>
                  {formatWeekdayShort(cd.scheduledFor)} is left off: it has invoice{" "}
                  <Link href={`/invoices/${inv.id}`} className="underline">
                    #{inv.invoiceNumber}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {billCount > 0 && !existingMonthInvoice ? (
              <p className="text-sm font-semibold text-slate-900">Total {formatMoney(billTotal)}</p>
            ) : (
              <span />
            )}
            {existingMonthInvoice ? (
              <Link href={`/invoices/${existingMonthInvoice.id}`} className="button-secondary">
                Open {selectedMonthLabel} invoice #{existingMonthInvoice.invoiceNumber}
              </Link>
            ) : (
              <form action={createMonthlyInvoice.bind(null, client.id, selectedBillMonth, "")}>
                <button
                  className={monthly ? "button-primary" : "button-secondary"}
                  disabled={billCount === 0}
                >
                  Create {selectedMonthLabel} invoice
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Upcoming cook dates */}
      {upcomingCookDates.length > 0 && (
        <section>
          <h2 className="section-title mb-4">
            Upcoming cook dates
          </h2>
          <div className="space-y-3">
            {upcomingCookDates.map((cd) => (
              <Link
                key={cd.id}
                href={`/cook-dates/${cd.id}`}
                className="block panel p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {formatDateLong(cd.scheduledFor)}
                      </p>
                      <StatusBadge status={cd.status} />
                    </div>
                    {cd.startTimeLabel && (
                      <p className="mt-0.5 text-sm text-slate-500">
                        {cd.startTimeLabel}
                      </p>
                    )}
                    {cd.serviceNotes && (
                      <p className="mt-1 text-sm text-slate-600">
                        {cd.serviceNotes}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>
                      {cd.proposals.length} proposal{cd.proposals.length !== 1 ? "s" : ""}
                    </p>
                    {cd.menuCards.length > 0 && (
                      <p>{cd.menuCards.length} Bon Appetit</p>
                    )}
                    {cd.finalizedProposal && (
                      <p className="font-medium text-[var(--accent)]">
                        Menu approved
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Past cook dates */}
      {pastCookDates.length > 0 && (
        <section>
          <h2 className="section-title mb-4">
            Past cook dates
          </h2>
          <div className="space-y-2">
            {pastCookDates.map((cd) => (
              <Link
                key={cd.id}
                href={`/cook-dates/${cd.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-slate-700">
                    {formatDateShort(cd.scheduledFor)}
                  </p>
                  <StatusBadge status={cd.status} />
                </div>
                <p className="text-xs text-slate-500">
                  {cd.finalizedProposal?.title || `${cd.proposals.length} proposal${cd.proposals.length !== 1 ? "s" : ""}`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Invoices */}
      {standaloneInvoices.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Invoices</h2>
          <div className="space-y-2">
            {standaloneInvoices.map((inv) => {
              const total = inv.lineItems.reduce(
                (sum, li) => sum + li.amount,
                0,
              );
              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      #{inv.invoiceNumber}
                    </p>
                    <StatusBadge status={inv.status} />
                    <p className="text-xs text-slate-500">
                      {formatDateShort(inv.invoiceDate)}
                      {inv.billingPeriod
                        ? ` · Monthly · ${formatMonthKey(inv.billingPeriod)}`
                        : inv.cookDateId && cookDateById.get(inv.cookDateId)
                          ? ` · Cook date ${formatWeekdayShort(cookDateById.get(inv.cookDateId)!.scheduledFor)}`
                          : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {formatMoney(total)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Ad-hoc Bon Appetits (no cook date) */}
      {client.menuCards.length > 0 && (
        <section>
          <h2 className="section-title mb-4">
            Ad-hoc Bon Appetits
          </h2>
          <div className="space-y-2">
            {client.menuCards.map((mc) => (
              <Link
                key={mc.id}
                href={`/menu-cards/${mc.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {mc.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateShort(mc.menuDate)} &middot;{" "}
                    {mc.recipes.length} recipe{mc.recipes.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {client.cookDates.length === 0 &&
        client.invoices.length === 0 &&
        client.menuCards.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No cook dates, invoices, or Bon Appetits yet. Use the buttons above
            to get started.
          </div>
        )}
    </div>
  );
}
