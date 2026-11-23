import {
  ChefHat,
  CircleCheck,
  ExternalLink,
  FileDown,
  FilePlus2,
  Maximize2,
  Pencil,
  Send,
  SquarePen,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { approveProposal, quickCreateProposal } from "@/app/actions";
import { createInvoiceForCookDate, createMonthlyInvoice } from "@/app/billing-actions";
import { ClientPagePreview } from "@/components/client-page-preview";
import { CookDateGroceries, CookDateGroceriesLoading } from "@/components/cook-date-groceries";
import { CookDateHeader } from "@/components/cook-date-header";
import { CookDateWalkthrough } from "@/components/cook-date-walkthrough";
import { DeleteCookDateButton } from "@/components/delete-cook-date-button";
import { DocumentPreview } from "@/components/document-preview";
import { GroceriesBought } from "@/components/groceries-bought";
import { RecordPaymentForm } from "@/components/record-payment-form";
import { SendToClientButton } from "@/components/send-to-client-button";
import { StatusBadge } from "@/components/status-badge";
import { findCookDateInvoice, monthKeyOf } from "@/lib/billing";
import {
  activeProposal,
  computeProgress,
  isMenuApproved,
  isMonthlyBilling,
  type StepKey,
} from "@/lib/cook-date-progress";
import { formatDayShort, formatMonthKey, formatWeekdayLong, todayYmd } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { parseCheckedKeys } from "@/lib/recipe-facts-format";
import { parseTasteDishes, stars, TASTE_RATING_LABEL } from "@/lib/taste";

const proposalInclude = {
  recipes: {
    include: { recipe: { select: { title: true } } },
    orderBy: { position: "asc" as const },
  },
};

const RATING_CLASS = {
  loved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  liked: "bg-sky-50 text-sky-700 border-sky-200",
  not: "bg-rose-50 text-rose-700 border-rose-200",
} as const;

/** One step's panel: what it is, where it stands, and its buttons. */
function StepPanel({
  title,
  detail,
  actions,
  children,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {detail && <p className="mt-1 text-sm muted">{detail}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

function daysBetween(fromYmd: string, toYmd: string) {
  return Math.round((Date.parse(toYmd) - Date.parse(fromYmd)) / 86_400_000);
}

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
      tasteFeedback: true,
      groceryReceipts: { select: { id: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!cookDate) notFound();

  const invoice = await findCookDateInvoice(kitchen.id, cookDate);
  const invoiceTotal = invoice ? invoice.lineItems.reduce((s, li) => s + li.amount, 0) : 0;

  const { client } = cookDate;
  const clientName = `${client.firstName} ${client.lastName}`.trim();
  const first = client.firstName;
  const menu = activeProposal(cookDate);
  const approved = isMenuApproved(cookDate);
  const bonAppetit = cookDate.menuCards[0] ?? null;
  const taste = cookDate.tasteFeedback;
  const monthly = isMonthlyBilling(client.billingMode);
  const monthKey = monthKeyOf(cookDate.scheduledFor);
  const monthLabel = formatMonthKey(monthKey); // "November 2026"
  const monthName = monthLabel.split(" ")[0]; // "November"
  const cookYmd = todayYmd(cookDate.scheduledFor);
  const daysSinceCookDate = daysBetween(cookYmd, todayYmd());
  const cookDay = formatWeekdayLong(cookDate.scheduledFor);
  const checkedCount = parseCheckedKeys(cookDate.groceryChecked).length;

  const progress = computeProgress({
    cancelled: cookDate.status === "CANCELLED",
    menuSent: !!menu && (menu.status === "SENT" || menu.status === "APPROVED"),
    approved,
    hasBonAppetit: !!bonAppetit,
    bonAppetitSent: !!bonAppetit?.sentAt,
    groceriesDone: !!cookDate.groceriesDoneAt,
    daysSinceCookDate,
    tasteSent: !!taste?.sentAt || !!taste?.submittedAt,
    hasInvoice: !!invoice,
    paid: invoice?.status === "PAID",
  });
  const isCurrent = (k: StepKey) => progress.current === k;
  const btn = (k: StepKey) => (isCurrent(k) ? "button-primary" : "button-secondary");

  const paidText =
    invoice?.status === "PAID"
      ? invoice.paidMethod && invoice.paidAt
        ? `Paid by ${invoice.paidMethod} on ${formatDayShort(invoice.paidAt)}`
        : invoice.paidAt
          ? `Paid on ${formatDayShort(invoice.paidAt)}`
          : "Paid"
      : null;

  // ── The menu, shown inside Proposed / Accepted ──
  const menuDishes = menu?.recipes ?? [];
  const otherVersions = cookDate.proposals.filter((p) => p.id !== menu?.id);
  const openMenuLink = menu && (
    <Link href={`/proposals/${menu.id}`} aria-label="Edit the menu" data-tip="Edit the menu" className="button-icon">
      <SquarePen aria-hidden="true" />
    </Link>
  );
  const menuBlock = menu ? (
    <div className="rounded-xl border border-[var(--line)] p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
        {menu.title} <StatusBadge status={menu.status} />
      </p>
      {menuDishes.length > 0 ? (
        <ul className="mt-3 divide-y divide-[var(--line)]">
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
        <p className="mt-2 text-sm muted">No dishes yet.</p>
      )}
      {otherVersions.length > 0 && (
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide muted">Other versions</p>
          <ul className="mt-1">
            {otherVersions.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/proposals/${p.id}`}
                  className="flex min-h-11 flex-wrap items-center gap-2 text-sm text-ink hover:underline"
                >
                  {p.title}
                  <StatusBadge status={p.status} />
                  <span className="text-xs muted">
                    {p.recipes.length} dish{p.recipes.length === 1 ? "" : "es"} · {formatDayShort(p.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : null;

  // ── 1. Proposed (planning the menu included) ──
  const hasDishes = !!menu && menuDishes.length > 0;
  const proposedPanel = (
    <StepPanel
      title={progress.done.proposed ? "Menu sent" : hasDishes ? "Send the menu" : "Plan the menu"}
      detail={
        progress.done.proposed
          ? menu?.sentAt
            ? `Sent to ${first} on ${formatDayShort(menu.sentAt)}.`
            : `${first} has the menu.`
          : !hasDishes
            ? menu
              ? "The menu has no dishes yet."
              : `Pick the dishes for ${first}.`
            : menu?.status === "REVISIONS_REQUESTED"
              ? `${first} asked for changes. Update the menu, then send it again.`
              : `The menu is ready to send to ${first}.`
      }
      actions={
        menu ? (
          progress.done.proposed ? (
            openMenuLink
          ) : (
            <Link href={`/proposals/${menu.id}`} className={btn("proposed")}>
              {hasDishes ? <Send aria-hidden="true" /> : <ChefHat aria-hidden="true" />}
              {hasDishes ? "Send menu to client" : "Plan the menu"}
            </Link>
          )
        ) : (
          <form action={quickCreateProposal}>
            <input type="hidden" name="cookDateId" value={cookDate.id} />
            <button className={btn("proposed")}>
              <ChefHat aria-hidden="true" />
              Plan the menu
            </button>
          </form>
        )
      }
    >
      {hasDishes ? <ClientPagePreview src={`/preview/review/${menu.id}`} firstName={first} /> : menuBlock}
    </StepPanel>
  );

  // ── 2. Accepted ──
  let acceptedTitle: React.ReactNode;
  let acceptedDetail: React.ReactNode;
  let acceptedActions: React.ReactNode = null;
  const approveForm = (primary: boolean) =>
    menu && (
      <form action={approveProposal}>
        <input type="hidden" name="proposalId" value={menu.id} />
        <button className={primary ? "button-primary" : "button-secondary"}>
          <CircleCheck aria-hidden="true" />
          Client approved
        </button>
      </form>
    );
  if (progress.done.accepted) {
    acceptedTitle = "Menu approved";
    acceptedDetail = menu?.clientComment
      ? `${first} wrote: “${menu.clientComment}”`
      : menu?.approvedAt
        ? `Approved ${formatDayShort(menu.approvedAt)}.`
        : `${first} approved the menu.`;
    acceptedActions = openMenuLink;
  } else if (!progress.done.proposed) {
    acceptedTitle = `Waiting for ${first}`;
    acceptedDetail = "Send the menu first.";
  } else if (menu?.clientSubmittedAt && menu.clientApproved) {
    acceptedTitle = `${first} approved the menu`;
    acceptedDetail = menu.clientComment ? `“${menu.clientComment}”` : "Confirm it to make the Bon Appetit.";
    acceptedActions = (
      <>
        {approveForm(true)}
        {openMenuLink}
      </>
    );
  } else if (menu?.clientSubmittedAt) {
    acceptedTitle = `${first} asked for changes`;
    acceptedDetail = menu.clientComment ? `“${menu.clientComment}”` : "Open the menu to see what changed.";
    acceptedActions = (
      <>
        <Link href={`/proposals/${menu.id}`} className="button-primary">
          <SquarePen aria-hidden="true" />
          Update the menu
        </Link>
        {approveForm(false)}
      </>
    );
  } else {
    acceptedTitle = `Waiting for ${first}`;
    acceptedDetail = menu?.sentAt
      ? `Menu sent ${formatDayShort(menu.sentAt)}. If ${first} approved by text or phone, mark it here.`
      : `If ${first} approved by text or phone, mark it here.`;
    acceptedActions = (
      <>
        {approveForm(false)}
        {openMenuLink}
      </>
    );
  }
  const acceptedPanel = (
    <StepPanel title={acceptedTitle} detail={acceptedDetail} actions={acceptedActions}>
      {hasDishes ? <ClientPagePreview src={`/preview/review/${menu.id}`} firstName={first} /> : menuBlock}
    </StepPanel>
  );

  // ── 3. Bon Appetit ──
  const makeBonAppetit = (
    <Link
      href={`/menu-cards?clientId=${cookDate.clientId}&cookDateId=${cookDate.id}`}
      className={bonAppetit ? "button-secondary" : btn("bonAppetit")}
    >
      <FilePlus2 aria-hidden="true" />
      Make Bon Appetit
    </Link>
  );
  const bonAppetitPanel = bonAppetit ? (
    <StepPanel
      title={bonAppetit.sentAt ? "Bon Appetit sent" : "Send the Bon Appetit"}
      detail={
        <>
          <Link href={`/menu-cards/${bonAppetit.id}`} className="font-semibold text-ink hover:underline">
            {bonAppetit.title}
          </Link>{" "}
          · {bonAppetit._count.recipes} dish{bonAppetit._count.recipes === 1 ? "" : "es"}
          {bonAppetit.sentAt && <> · Sent {formatDayShort(bonAppetit.sentAt)}</>}
        </>
      }
      actions={
        <>
          <SendToClientButton
            kind="menuCard"
            id={bonAppetit.id}
            clientEmail={client.email}
            variant={bonAppetit.sentAt ? "secondary" : "primary"}
            label={bonAppetit.sentAt ? "Send again" : "Send to client"}
          />
          <a
            href={`/api/menu-cards/${bonAppetit.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the PDF"
            data-tip="PDF"
            className="button-icon"
          >
            <FileDown aria-hidden="true" />
          </a>
        </>
      }
    >
      <DocumentPreview src={`/api/menu-cards/${bonAppetit.id}/html`} title={`Preview of ${bonAppetit.title}`} />
      {cookDate.menuCards.length > 1 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide muted">Other Bon Appetits</p>
          <ul className="mt-1">
            {cookDate.menuCards.slice(1).map((mc) => (
              <li key={mc.id}>
                <Link href={`/menu-cards/${mc.id}`} className="flex min-h-11 items-center gap-2 text-sm text-ink hover:underline">
                  {mc.title}
                  <span className="text-xs muted">
                    {formatDayShort(mc.createdAt)}
                    {mc.sentAt ? ` · Sent ${formatDayShort(mc.sentAt)}` : " · Not sent"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </StepPanel>
  ) : (
    <StepPanel
      title="Make the Bon Appetit"
      detail={approved ? "The menu is approved." : "Made once the menu is approved."}
      actions={approved ? makeBonAppetit : null}
    />
  );

  // ── 4. Groceries ──
  const groceriesPanel = (
    <StepPanel
      title={progress.done.groceries ? "Groceries done" : "Groceries"}
      detail={
        !approved && !bonAppetit
          ? "The grocery list fills in once the menu is approved."
          : checkedCount > 0
            ? `${checkedCount} item${checkedCount === 1 ? "" : "s"} checked off so far.`
            : `Everything for ${cookDay}, scaled to the guests. Tap an item to check it off.`
      }
      actions={
        approved || bonAppetit ? (
          <Link
            href={`/cook-dates/${cookDate.id}/groceries`}
            aria-label="Open the grocery list on its own page"
            data-tip="Full page"
            className="button-icon"
          >
            <Maximize2 aria-hidden="true" />
          </Link>
        ) : null
      }
    >
      {(approved || bonAppetit) && (
        <>
          <GroceriesBought
            cookDateId={cookDate.id}
            boughtLabel={cookDate.groceriesDoneAt ? formatDayShort(cookDate.groceriesDoneAt) : null}
            cost={cookDate.groceryCost}
            receiptIds={cookDate.groceryReceipts.map((r) => r.id)}
            primary={isCurrent("groceries")}
          />
          <Suspense fallback={<CookDateGroceriesLoading />}>
            <CookDateGroceries cookDateId={cookDate.id} kitchenId={kitchen.id} />
          </Suspense>
        </>
      )}
    </StepPanel>
  );

  // ── 5. How did it taste? ──
  const tasteDishes = parseTasteDishes(taste?.dishes);
  const sendTaste = (label: string, primary: boolean) => (
    <SendToClientButton
      kind="taste"
      id={cookDate.id}
      clientEmail={client.email}
      variant={primary ? "primary" : "secondary"}
      label={label}
    />
  );
  let tastePanel: React.ReactNode;
  if (taste?.submittedAt) {
    tastePanel = (
      <StepPanel
        title={`${first} answered`}
        detail={`Answered ${formatDayShort(taste.submittedAt)}.`}
        actions={
          <a
            href={`/taste/${taste.token}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${first}'s page`}
            data-tip={`${first}'s page`}
            className="button-icon"
          >
            <ExternalLink aria-hidden="true" />
          </a>
        }
      >
        <div className="space-y-4 rounded-xl border border-[var(--line)] p-4">
          {taste.overall && (
            <p className="text-sm text-ink">
              <span className="text-2xl leading-none text-amber-400" aria-hidden>
                {stars(taste.overall)}
              </span>
              <span className="ml-2 align-middle muted">{taste.overall} of 5 overall</span>
            </p>
          )}
          {tasteDishes.length > 0 && (
            <ul className="divide-y divide-[var(--line)]">
              {tasteDishes.map((d) => (
                <li key={d.recipeId} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="text-sm text-ink">{d.title}</span>
                  {d.rating ? (
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${RATING_CLASS[d.rating]}`}>
                      {TASTE_RATING_LABEL[d.rating]}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs muted">No answer</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {taste.comment && (
            <blockquote className="border-l-2 border-[var(--accent)] pl-3 text-sm text-ink">“{taste.comment}”</blockquote>
          )}
        </div>
      </StepPanel>
    );
  } else if (taste?.sentAt) {
    tastePanel = (
      <StepPanel
        title={`Waiting for ${first}`}
        detail={`“How did everything taste?” sent ${formatDayShort(taste.sentAt)}. You'll get an email when ${first} answers.`}
        actions={
          <>
            {sendTaste("Send again", false)}
            <a
              href={`/taste/${taste.token}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${first}'s page`}
              data-tip={`${first}'s page`}
              className="button-icon"
            >
              <ExternalLink aria-hidden="true" />
            </a>
          </>
        }
      >
        <ClientPagePreview src={`/preview/taste/${cookDate.id}`} firstName={first} />
      </StepPanel>
    );
  } else if (!bonAppetit && !approved) {
    tastePanel = (
      <StepPanel title="How did it taste?" detail="Sent after the cook date, once there is a menu." />
    );
  } else {
    tastePanel = (
      <StepPanel
        title={`Ask ${first} how everything tasted`}
        detail={
          progress.skipped.taste
            ? "Not sent. The cook date was more than two weeks ago."
            : daysSinceCookDate < 0
              ? `Best sent after the cook date on ${cookDay}. ${first} rates each dish and the meal overall; no login.`
              : `${first} rates each dish and the meal overall; no login. You get an email with the answers.`
        }
        actions={sendTaste("Send “How did it taste?”", isCurrent("taste"))}
      >
        <ClientPagePreview src={`/preview/taste/${cookDate.id}`} firstName={first} />
      </StepPanel>
    );
  }

  // ── 6. Invoice ──
  const invoiceRow = invoice && (
    <Link
      href={`/invoices/${invoice.id}`}
      className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3 hover:bg-[var(--surface-raised)]"
    >
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-ink">#{invoice.invoiceNumber}</span>
        <StatusBadge status={invoice.status} />
        {invoice.billingPeriod && <span className="muted">Monthly · {formatMonthKey(invoice.billingPeriod)}</span>}
        {paidText && <span className="muted">{paidText}</span>}
      </span>
      <span className="text-sm font-semibold text-ink">{formatMoney(invoiceTotal)}</span>
    </Link>
  );
  const groceriesNotInvoiced =
    !!invoice &&
    !!cookDate.groceryCost &&
    invoice.status !== "PAID" &&
    invoice.status !== "VOID" &&
    !invoice.lineItems.some((li) => /grocer/i.test(li.description));
  const invoicePanel = invoice ? (
    <StepPanel
      title={invoice.billingPeriod ? `${monthName} invoice #${invoice.invoiceNumber}` : `Invoice #${invoice.invoiceNumber}`}
      detail={
        <>
          {formatMoney(invoiceTotal)} · <StatusBadge status={invoice.status} />
          {invoice.billingPeriod && <> · One invoice for all of {monthLabel}</>}
          {paidText && <> · {paidText}</>}
        </>
      }
      actions={
        <>
          {invoice.status !== "PAID" && invoice.status !== "VOID" && (
            <SendToClientButton kind="invoice" id={invoice.id} clientEmail={client.email} variant="secondary" />
          )}
          <Link href={`/invoices/${invoice.id}`} aria-label="Edit the invoice" data-tip="Edit" className="button-icon">
            <Pencil aria-hidden="true" />
          </Link>
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the PDF"
            data-tip="PDF"
            className="button-icon"
          >
            <FileDown aria-hidden="true" />
          </a>
        </>
      }
    >
      {groceriesNotInvoiced && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Groceries ({formatMoney(cookDate.groceryCost ?? 0)}) aren&apos;t on this invoice yet. Use Edit to add them.
        </p>
      )}
      <DocumentPreview src={`/api/invoices/${invoice.id}/html`} title={`Preview of invoice #${invoice.invoiceNumber}`} />
    </StepPanel>
  ) : monthly ? (
    <StepPanel
      title={`Billed monthly — ${monthName} invoice`}
      detail={`${first} gets one invoice for all of ${monthLabel}. No ${monthLabel} invoice yet.`}
      actions={
        <form action={createMonthlyInvoice.bind(null, cookDate.clientId, monthKey)}>
          <button className={btn("invoice")}>
            <FilePlus2 aria-hidden="true" />
            Create {monthName} invoice
          </button>
        </form>
      }
    />
  ) : (
    <StepPanel
      title="Invoice"
      detail={
        client.defaultRate
          ? `Starts with ${formatMoney(client.defaultRate)} for the cook date${client.travelFee ? ` and ${formatMoney(client.travelFee)} travel` : ""}. Add groceries before sending.`
          : "Add the rate and groceries before sending."
      }
      actions={
        <form action={createInvoiceForCookDate.bind(null, cookDate.id)}>
          <button className={btn("invoice")}>
            <FilePlus2 aria-hidden="true" />
            Create invoice
          </button>
        </form>
      }
    />
  );

  // ── 7. Paid ──
  const paidPanel = !invoice ? (
    <StepPanel title="Payment" detail="Create the invoice first." />
  ) : invoice.status === "PAID" ? (
    <StepPanel title="Paid" detail={paidText}>
      {invoiceRow}
    </StepPanel>
  ) : (
    <StepPanel
      title={invoice.billingPeriod ? `Payment for the ${monthName} invoice` : "Payment"}
      detail={`Mark it paid when ${first} pays.`}
      actions={<RecordPaymentForm invoiceId={invoice.id} primary={isCurrent("paid")} />}
    >
      {invoiceRow}
    </StepPanel>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8 fade-up">
      <CookDateHeader
        cookDate={{
          id: cookDate.id,
          title: cookDay,
          ymd: cookYmd,
          startTimeLabel: cookDate.startTimeLabel,
          guestCount: cookDate.guestCount,
          serviceNotes: cookDate.serviceNotes,
          cancelled: cookDate.status === "CANCELLED",
          client: { id: client.id, name: clientName },
        }}
      />

      {/* Keyed on the current step: after any action moves the job along,
          the steps open on the new current step. */}
      <CookDateWalkthrough
        key={progress.current ?? "done"}
        progress={progress}
        cancelledNote={<p className="text-sm muted">This cook date is cancelled. Use Edit to bring it back.</p>}
        panels={{
          proposed: proposedPanel,
          accepted: acceptedPanel,
          bonAppetit: bonAppetitPanel,
          groceries: groceriesPanel,
          taste: tastePanel,
          invoice: invoicePanel,
          paid: paidPanel,
        }}
      />

      {/* Quiet: delete */}
      <div className="flex justify-end border-t border-[var(--line)] pt-6">
        <DeleteCookDateButton cookDateId={cookDate.id} clientId={cookDate.clientId} quiet />
      </div>
    </div>
  );
}
