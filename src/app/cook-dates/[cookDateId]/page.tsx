import Link from "next/link";
import { notFound } from "next/navigation";
import { approveProposal, quickCreateProposal } from "@/app/actions";
import { createInvoiceForCookDate, createMonthlyInvoice } from "@/app/billing-actions";
import { CookDateHeader } from "@/components/cook-date-header";
import { CookDateProgressBar } from "@/components/cook-date-progress-bar";
import { DeleteCookDateButton } from "@/components/delete-cook-date-button";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { SendToClientButton } from "@/components/send-to-client-button";
import { StatusBadge } from "@/components/status-badge";
import { findCookDateInvoice, monthKeyOf } from "@/lib/billing";
import {
  activeProposal,
  computeProgress,
  isMenuApproved,
  isMonthlyBilling,
} from "@/lib/cook-date-progress";
import { formatDayShort, formatMonthKey, formatWeekdayLong, todayYmd } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

const proposalInclude = {
  recipes: {
    include: { recipe: { select: { title: true } } },
    orderBy: { position: "asc" as const },
  },
};

export default async function CookDateDetailPage({
  params,
}: {
  params: Promise<{ cookDateId: string }>;
}) {
  const { cookDateId } = await params;
  const kitchen = await requireKitchen();

  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId: kitchen.id },
    include: {
      client: true,
      finalizedProposal: { include: proposalInclude },
      proposals: { include: proposalInclude, orderBy: { createdAt: "desc" } },
      menuCards: {
        include: { _count: { select: { recipes: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!cookDate) notFound();

  const invoice = await findCookDateInvoice(kitchen.id, cookDate);
  const invoiceTotal = invoice ? invoice.lineItems.reduce((s, li) => s + li.amount, 0) : 0;

  const { client } = cookDate;
  const clientName = `${client.firstName} ${client.lastName}`.trim();
  const menu = activeProposal(cookDate);
  const approved = isMenuApproved(cookDate);
  const bonAppetit = cookDate.menuCards[0] ?? null;
  const monthly = isMonthlyBilling(client.billingMode);
  const monthKey = monthKeyOf(cookDate.scheduledFor);
  const monthLabel = formatMonthKey(monthKey); // "November 2026"
  const monthName = monthLabel.split(" ")[0]; // "November"

  const progress = computeProgress({
    cancelled: cookDate.status === "CANCELLED",
    menuHasDishes: !!menu && menu.recipes.length > 0,
    menuSent: !!menu && (menu.status === "SENT" || menu.status === "APPROVED"),
    approved,
    hasBonAppetit: !!bonAppetit,
    hasInvoice: !!invoice,
    paid: invoice?.status === "PAID",
  });

  const paidText =
    invoice?.status === "PAID"
      ? invoice.paidMethod && invoice.paidAt
        ? `Paid by ${invoice.paidMethod} on ${formatDayShort(invoice.paidAt)}`
        : invoice.paidAt
          ? `Paid on ${formatDayShort(invoice.paidAt)}`
          : "Paid"
      : null;

  // ── The one next step ──
  let nextTitle = "";
  let nextDetail: React.ReactNode = null;
  let nextActions: React.ReactNode = null;

  switch (progress.current) {
    case "plan": {
      nextTitle = "Plan the menu";
      nextDetail = menu
        ? "The menu has no dishes yet."
        : `Pick the dishes for ${client.firstName}.`;
      nextActions = menu ? (
        <Link href={`/proposals/${menu.id}`} className="button-primary">
          Plan the menu
        </Link>
      ) : (
        <form action={quickCreateProposal}>
          <input type="hidden" name="cookDateId" value={cookDate.id} />
          <button className="button-primary">Plan the menu</button>
        </form>
      );
      break;
    }
    case "proposed": {
      nextTitle = "Send the menu";
      nextDetail =
        menu?.status === "REVISIONS_REQUESTED"
          ? `${client.firstName} asked for changes. Update the menu, then send it again.`
          : `The menu is ready to send to ${client.firstName}.`;
      nextActions = menu && (
        <Link href={`/proposals/${menu.id}`} className="button-primary">
          Send menu to client
        </Link>
      );
      break;
    }
    case "accepted": {
      const answered = !!menu?.clientSubmittedAt;
      const approveForm = (primary: boolean) =>
        menu && (
          <form action={approveProposal}>
            <input type="hidden" name="proposalId" value={menu.id} />
            <button className={primary ? "button-primary" : "button-secondary"}>Client approved</button>
          </form>
        );
      if (answered && menu?.clientApproved) {
        nextTitle = `${client.firstName} approved the menu`;
        nextDetail = menu.clientComment
          ? `“${menu.clientComment}”`
          : "Confirm it to make the Bon Appetit.";
        nextActions = (
          <>
            {approveForm(true)}
            <Link href={`/proposals/${menu.id}`} className="button-secondary">
              Open menu
            </Link>
          </>
        );
      } else if (answered && menu) {
        nextTitle = `${client.firstName} asked for changes`;
        nextDetail = menu.clientComment ? `“${menu.clientComment}”` : "Open the menu to see what changed.";
        nextActions = (
          <>
            <Link href={`/proposals/${menu.id}`} className="button-primary">
              Open menu
            </Link>
            {approveForm(false)}
          </>
        );
      } else {
        nextTitle = `Waiting for ${client.firstName}`;
        nextDetail = menu?.sentAt
          ? `Menu sent ${formatDayShort(menu.sentAt)}. If ${client.firstName} approved by text or phone, mark it here.`
          : `If ${client.firstName} approved by text or phone, mark it here.`;
        nextActions = (
          <>
            {approveForm(false)}
            {menu && (
              <Link href={`/proposals/${menu.id}`} className="button-secondary">
                Open menu
              </Link>
            )}
          </>
        );
      }
      break;
    }
    case "bonAppetit": {
      nextTitle = "Make the Bon Appetit";
      nextDetail = "The menu is approved.";
      nextActions = (
        <Link
          href={`/menu-cards?clientId=${cookDate.clientId}&cookDateId=${cookDate.id}`}
          className="button-primary"
        >
          Make Bon Appetit
        </Link>
      );
      break;
    }
    case "invoice": {
      if (monthly) {
        nextTitle = `Billed monthly — ${monthName} invoice`;
        nextDetail = `${client.firstName} gets one invoice for all of ${monthLabel}.`;
        nextActions = (
          <form action={createMonthlyInvoice.bind(null, cookDate.clientId, monthKey)}>
            <button className="button-primary">Create {monthName} invoice</button>
          </form>
        );
      } else {
        nextTitle = "Invoice";
        nextDetail = client.defaultRate
          ? `Starts with ${formatMoney(client.defaultRate)} for the cook date${client.travelFee ? ` and ${formatMoney(client.travelFee)} travel` : ""}. Add groceries before sending.`
          : "Add the rate and groceries before sending.";
        nextActions = (
          <form action={createInvoiceForCookDate.bind(null, cookDate.id)}>
            <button className="button-primary">Create invoice</button>
          </form>
        );
      }
      break;
    }
    case "paid": {
      nextTitle = invoice?.billingPeriod
        ? `Payment for the ${monthName} invoice`
        : "Payment";
      nextDetail = invoice && (
        <>
          <Link href={`/invoices/${invoice.id}`} className="font-semibold hover:underline">
            Invoice #{invoice.invoiceNumber}
          </Link>{" "}
          · {formatMoney(invoiceTotal)} · <StatusBadge status={invoice.status} />
        </>
      );
      nextActions = invoice && <RecordPaymentForm invoiceId={invoice.id} primary />;
      break;
    }
    default:
      break;
  }

  const menuDishes = menu?.recipes ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8 fade-up">
      <CookDateHeader
        cookDate={{
          id: cookDate.id,
          title: formatWeekdayLong(cookDate.scheduledFor),
          ymd: todayYmd(cookDate.scheduledFor),
          startTimeLabel: cookDate.startTimeLabel,
          guestCount: cookDate.guestCount,
          serviceNotes: cookDate.serviceNotes,
          cancelled: cookDate.status === "CANCELLED",
          client: { id: client.id, name: clientName },
        }}
      />

      {/* Steps + the one next step */}
      <section aria-labelledby="next-step" className="panel space-y-6 p-5 sm:p-6">
        <CookDateProgressBar progress={progress} />
        <div className="border-t border-[var(--line)] pt-5">
          {progress.cancelled ? (
            <p id="next-step" className="text-sm muted">
              This cook date is cancelled. Use Edit to bring it back.
            </p>
          ) : progress.current ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 id="next-step" className="section-title">
                  {nextTitle}
                </h2>
                {nextDetail && <p className="mt-1 text-sm muted">{nextDetail}</p>}
              </div>
              {nextActions && <div className="flex shrink-0 flex-wrap items-center gap-2">{nextActions}</div>}
            </div>
          ) : (
            <div>
              <h2 id="next-step" className="section-title">
                All done
              </h2>
              <p className="mt-1 text-sm muted">{paidText ?? "Paid"}</p>
            </div>
          )}
        </div>
      </section>

      {/* Menu */}
      <section aria-labelledby="menu-heading" className="panel p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="menu-heading" className="section-title">
            Menu
          </h2>
          {menu && (
            <Link
              href={`/proposals/${menu.id}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent-strong)] hover:underline"
            >
              Open menu
            </Link>
          )}
        </div>
        {menu ? (
          <>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm muted">
              {menu.title} <StatusBadge status={menu.status} />
            </p>
            {menuDishes.length > 0 ? (
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {menuDishes.map((item) => (
                  <li key={item.id} className="flex items-baseline justify-between gap-4 py-2.5">
                    <span
                      className={`text-sm ${item.clientRemoved ? "text-[var(--muted-fg)] line-through" : "text-ink"}`}
                    >
                      {item.recipe.title}
                      {item.courseLabel && <span className="ml-2 text-xs muted no-underline">{item.courseLabel}</span>}
                    </span>
                    {item.clientRemoved && <span className="shrink-0 text-xs muted">Client removed</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm muted">No dishes yet.</p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm muted">No menu yet.</p>
        )}
      </section>

      {/* Bon Appetit */}
      <section aria-labelledby="ba-heading" className="panel p-5 sm:p-6">
        <h2 id="ba-heading" className="section-title">
          Bon Appetit
        </h2>
        {cookDate.menuCards.length > 0 ? (
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {cookDate.menuCards.map((mc) => (
              <li key={mc.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/menu-cards/${mc.id}`} className="text-sm font-semibold text-ink hover:underline">
                    {mc.title}
                  </Link>
                  <p className="mt-0.5 text-xs muted">
                    {mc._count.recipes} dish{mc._count.recipes === 1 ? "" : "es"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SendToClientButton kind="menuCard" id={mc.id} clientEmail={client.email} variant="secondary" />
                  <a
                    href={`/api/menu-cards/${mc.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="button-secondary text-sm"
                  >
                    Preview PDF
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm muted">
            {approved ? "No Bon Appetit yet." : "Made when the menu is approved."}
          </p>
        )}
      </section>

      {/* Invoice */}
      <section aria-labelledby="invoice-heading" className="panel p-5 sm:p-6">
        <h2 id="invoice-heading" className="section-title">
          Invoice
        </h2>
        {invoice ? (
          <Link
            href={`/invoices/${invoice.id}`}
            className="mt-3 flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] px-4 py-3 hover:bg-[var(--surface-raised)]"
          >
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-ink">#{invoice.invoiceNumber}</span>
              <StatusBadge status={invoice.status} />
              {invoice.billingPeriod && (
                <span className="muted">Monthly · {formatMonthKey(invoice.billingPeriod)}</span>
              )}
              {paidText && <span className="muted">{paidText}</span>}
            </span>
            <span className="text-sm font-semibold text-ink">{formatMoney(invoiceTotal)}</span>
          </Link>
        ) : (
          <p className="mt-3 text-sm muted">
            {monthly ? `Billed monthly. No ${monthLabel} invoice yet.` : "No invoice yet."}
          </p>
        )}
      </section>

      {/* Groceries */}
      <Link
        href={`/cook-dates/${cookDate.id}/groceries`}
        className="panel flex min-h-14 items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--surface-raised)] sm:px-6"
      >
        <span className="section-title">Groceries</span>
        <span className="text-sm font-medium text-[var(--accent-strong)]">Open grocery list →</span>
      </Link>

      {/* Quiet: delete */}
      <div className="flex justify-end border-t border-[var(--line)] pt-6">
        <DeleteCookDateButton cookDateId={cookDate.id} clientId={cookDate.clientId} quiet />
      </div>
    </div>
  );
}
