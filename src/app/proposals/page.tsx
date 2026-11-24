import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PlanMenuButton } from "@/components/plan-menu-button";
import { monthKeyOf } from "@/lib/billing";
import {
  activeProposal,
  progressFor,
  STEP_KEYS,
  STEP_LABEL,
  type CookDateProgress,
  type StepKey,
} from "@/lib/cook-date-progress";
import { addDays, formatWeekdayShort, todayStart, todayYmd } from "@/lib/dates";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

// Every cook date as a card: the client, the day, the seven steps as a bar,
// and what comes next. A card opens the cook date's steps on that next step.

const proposalSelect = {
  id: true,
  status: true,
  createdAt: true,
  recipes: { where: { clientRemoved: false }, select: { id: true } },
} as const;

// Past cook dates still waiting on something stay up top for this long.
const TO_FINISH_DAYS = 60;

export default async function MealPlannerPage() {
  const kitchen = await requireKitchen();
  const [cookDates, invoices, clients] = await Promise.all([
    prisma.cookDate.findMany({
      where: { kitchenId: kitchen.id },
      select: {
        id: true,
        clientId: true,
        status: true,
        scheduledFor: true,
        groceriesDoneAt: true,
        finalizedProposalId: true,
        client: { select: { firstName: true, lastName: true } },
        finalizedProposal: { select: proposalSelect },
        proposals: { select: proposalSelect, orderBy: { createdAt: "desc" } },
        menuCards: { select: { sentAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        tasteFeedback: { select: { sentAt: true, submittedAt: true } },
      },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.invoice.findMany({
      where: { kitchenId: kitchen.id, status: { not: "VOID" }, archivedAt: null },
      select: { status: true, cookDateId: true, clientId: true, billingPeriod: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { kitchenId: kitchen.id, active: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  // Same rule as findCookDateInvoice: its own invoice, else the client's
  // monthly invoice for that month. Newest first, so the first match wins.
  const ownInvoice = new Map<string, (typeof invoices)[number]>();
  const monthlyInvoice = new Map<string, (typeof invoices)[number]>();
  for (const inv of invoices) {
    if (inv.cookDateId && !ownInvoice.has(inv.cookDateId)) ownInvoice.set(inv.cookDateId, inv);
    const key = inv.billingPeriod ? `${inv.clientId}:${inv.billingPeriod}` : null;
    if (key && !monthlyInvoice.has(key)) monthlyInvoice.set(key, inv);
  }

  const today = todayYmd();
  const start = todayStart();
  const finishFrom = addDays(start, -TO_FINISH_DAYS);
  const cards = cookDates.map((cd) => {
    const invoice =
      ownInvoice.get(cd.id) ?? monthlyInvoice.get(`${cd.clientId}:${monthKeyOf(cd.scheduledFor)}`) ?? null;
    const menu = activeProposal(cd);
    return {
      cd,
      progress: progressFor(cd, invoice, today),
      dishCount: menu?.recipes.length ?? 0,
      hasInvoice: !!invoice,
    };
  });

  const live = cards.filter((c) => !c.progress.cancelled);
  const comingUp = live.filter((c) => c.cd.scheduledFor >= start);
  const toFinish = live
    .filter((c) => c.cd.scheduledFor < start && c.cd.scheduledFor >= finishFrom && c.progress.current)
    .reverse();
  const shown = new Set([...comingUp, ...toFinish].map((c) => c.cd.id));
  const past = live.filter((c) => !shown.has(c.cd.id)).reverse();
  const cancelled = cards.filter((c) => c.progress.cancelled).reverse();

  // "Plan a menu" opens an existing menu instead of making a second cook date
  // for the same client and day.
  const existingMenus = comingUp.flatMap((c) => {
    const menu = activeProposal(c.cd);
    return menu ? [{ clientId: c.cd.clientId, ymd: todayYmd(c.cd.scheduledFor), proposalId: menu.id }] : [];
  });

  return (
    <div className="space-y-10 fade-up">
      <section className="relative overflow-hidden rounded-3xl border accent-hero px-6 py-8 sm:px-8 sm:py-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--accent-light)] opacity-60 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[var(--accent-light)] opacity-60 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong)] opacity-80">
              Menus for every cook date
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Meal Planner</h1>
            <p className="mt-3 max-w-xl text-base text-slate-600">
              Every cook date and where it stands. Open one to pick up at the next step.
            </p>
          </div>
          <PlanMenuButton
            clients={clients}
            existing={existingMenus}
            today={today}
            className="button-primary px-6 py-3 text-base"
          />
        </div>
      </section>

      <CardSection
        id="coming-up"
        title="Coming up"
        note="Soonest first."
        cards={comingUp}
        empty="Nothing on the calendar yet. Use “+ Plan a menu” to start one."
      />

      {toFinish.length > 0 && (
        <CardSection
          id="to-finish"
          title="To finish"
          note={`Cooked in the last ${TO_FINISH_DAYS} days and still waiting on a step.`}
          cards={toFinish}
        />
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
            <span className="section-title">Past cook dates</span>
            <span className="text-sm text-slate-500">{past.length}</span>
          </summary>
          <CardGrid cards={past} />
        </details>
      )}

      {cancelled.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
            <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90" />
            <span className="section-title">Cancelled</span>
            <span className="text-sm text-slate-500">{cancelled.length}</span>
          </summary>
          <CardGrid cards={cancelled} />
        </details>
      )}
    </div>
  );
}

type Card = {
  cd: { id: string; scheduledFor: Date; client: { firstName: string; lastName: string } };
  progress: CookDateProgress;
  dishCount: number;
  hasInvoice: boolean;
};

function CardSection({
  id,
  title,
  note,
  cards,
  empty,
}: {
  id: string;
  title: string;
  note: string;
  cards: Card[];
  empty?: string;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {title}
        <span className="ml-2 font-sans text-sm font-normal text-slate-500">{cards.length}</span>
      </h2>
      <p className="mt-1 text-sm text-slate-500">{note}</p>
      {cards.length === 0 && empty ? (
        <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
          {empty}
        </div>
      ) : (
        <CardGrid cards={cards} />
      )}
    </section>
  );
}

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <CookDateCard key={c.cd.id} card={c} />
      ))}
    </div>
  );
}

function nextText(card: Card): { text: string; tone: "next" | "done" | "muted" } {
  const { progress, dishCount, hasInvoice } = card;
  const first = card.cd.client.firstName.split(/[ ,&]/)[0];
  if (progress.cancelled) return { text: "Cancelled", tone: "muted" };
  switch (progress.current) {
    case null:
      return { text: "All done", tone: "done" };
    case "proposed":
      return { text: dishCount ? "Send the menu" : "Plan the menu", tone: "next" };
    case "accepted":
      return { text: `Waiting for ${first} to approve`, tone: "next" };
    case "bonAppetit":
      return { text: "Send the Bon Appetit", tone: "next" };
    case "groceries":
      return { text: "Buy the groceries", tone: "next" };
    case "taste":
      return { text: "Ask how it tasted", tone: "next" };
    case "invoice":
      return { text: hasInvoice ? "Send the invoice" : "Create the invoice", tone: "next" };
    case "paid":
      return { text: "Waiting for payment", tone: "next" };
  }
}

function CookDateCard({ card }: { card: Card }) {
  const { cd, progress, dishCount } = card;
  const name = `${cd.client.firstName} ${cd.client.lastName}`.trim();
  const next = nextText(card);
  const stepNo = progress.current ? STEP_KEYS.indexOf(progress.current) + 1 : null;

  return (
    <Link
      href={`/cook-dates/${cd.id}`}
      className={`group flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md ${
        progress.cancelled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug text-ink">{name}</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatWeekdayShort(cd.scheduledFor)}
            {dishCount > 0 && ` · ${dishCount} dish${dishCount === 1 ? "" : "es"}`}
          </p>
        </div>
        <ChevronRight
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
        />
      </div>

      <StepBar progress={progress} />

      <p
        className={`text-sm font-semibold ${
          next.tone === "done" ? "text-emerald-700" : next.tone === "muted" ? "text-slate-500" : "text-[var(--accent-strong)]"
        }`}
      >
        {stepNo && <span className="font-normal text-slate-500">Step {stepNo} of 7 · </span>}
        {next.tone === "next" ? `Next: ${next.text}` : next.text}
      </p>
    </Link>
  );
}

/** The seven steps as one bar: green done, accent for the next step, grey to come. */
function StepBar({ progress }: { progress: CookDateProgress }) {
  const label = (k: StepKey) =>
    `${STEP_LABEL[k]}: ${
      progress.skipped[k] ? "skipped" : progress.done[k] ? "done" : progress.current === k ? "next" : "to do"
    }`;
  return (
    <ol className="flex gap-1" aria-label={STEP_KEYS.map(label).join(", ")}>
      {STEP_KEYS.map((k) => (
        <li
          key={k}
          title={label(k)}
          className={`h-1.5 flex-1 rounded-full ${
            progress.cancelled
              ? "bg-slate-200"
              : progress.current === k
                ? "bg-[var(--accent)]"
                : progress.skipped[k]
                  ? "bg-emerald-200"
                  : progress.done[k]
                    ? "bg-emerald-500"
                    : "bg-slate-200"
          }`}
        />
      ))}
    </ol>
  );
}
