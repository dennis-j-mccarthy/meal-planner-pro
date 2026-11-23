import { createProposal } from "@/app/actions";
import Link from "next/link";
import { PlanMenuButton } from "@/components/plan-menu-button";
import { StatusBadge } from "@/components/status-badge";
import { todayStart, todayYmd } from "@/lib/dates";
import { formatDateShort } from "@/lib/format";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

export default async function MealPlannerPage() {
  const kitchen = await requireKitchen();
  const [cookDates, proposals, clients] = await Promise.all([
    prisma.cookDate.findMany({
      where: { kitchenId: kitchen.id },
      include: {
        client: true,
      },
      orderBy: {
        scheduledFor: "asc",
      },
    }),
    prisma.proposal.findMany({
      where: { kitchenId: kitchen.id },
      include: {
        cookDate: {
          include: {
            client: true,
          },
        },
        recipes: {
          include: { recipe: { select: { title: true } } },
          orderBy: { position: "asc" },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.client.findMany({
      where: { kitchenId: kitchen.id, active: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const start = todayStart();
  const byDateAsc = (a: (typeof proposals)[number], b: (typeof proposals)[number]) =>
    a.cookDate.scheduledFor.getTime() - b.cookDate.scheduledFor.getTime();
  const byDateDesc = (a: (typeof proposals)[number], b: (typeof proposals)[number]) => byDateAsc(b, a);

  const isUpcoming = (p: (typeof proposals)[number]) => p.cookDate.scheduledFor >= start;
  const live = proposals.filter((p) => p.status !== "ARCHIVED");

  // Upcoming cook dates and anything still being drafted come first, soonest first.
  const comingUp = live
    .filter((p) => isUpcoming(p) || p.status === "DRAFT" || p.status === "REVISIONS_REQUESTED")
    .sort(byDateAsc);
  const comingUpIds = new Set(comingUp.map((p) => p.id));
  const past = live.filter((p) => !comingUpIds.has(p.id)).sort(byDateDesc);
  const archived = proposals.filter((p) => p.status === "ARCHIVED").sort(byDateDesc);

  // "Plan a menu" opens an existing menu instead of making a second cook date
  // for the same client and day.
  const existingMenus = comingUp
    .filter(isUpcoming)
    .map((p) => ({ clientId: p.cookDate.clientId, ymd: todayYmd(p.cookDate.scheduledFor), proposalId: p.id }));

  function ProposalCard({ proposal }: { proposal: (typeof proposals)[number] }) {
    const clientName = `${proposal.cookDate.client.firstName} ${proposal.cookDate.client.lastName}`;
    const recipeCount = proposal.recipes.length;

    return (
      <Link
        href={`/proposals/${proposal.id}`}
        className="group block rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-[var(--accent)] hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
            {proposal.cookDate.client.firstName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{clientName}</h3>
              <StatusBadge status={proposal.status} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatDateShort(proposal.cookDate.scheduledFor)} · {proposal.title}
            </p>
            {recipeCount > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {proposal.recipes.slice(0, 4).map((item) => (
                  <span key={item.id} className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {item.recipe.title}
                  </span>
                ))}
                {recipeCount > 4 && (
                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    +{recipeCount - 4} more
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs font-medium text-[var(--accent-strong)]">No dishes yet. Open the planner</p>
            )}
          </div>
          <svg
            aria-hidden="true"
            className="mt-2 h-5 w-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-10 fade-up">
      {/* Hero header */}
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
              Pick a client and a date, then build the menu from your recipes and send it for approval.
            </p>
          </div>
          <PlanMenuButton
            clients={clients}
            existing={existingMenus}
            today={todayYmd()}
            className="button-primary px-6 py-3 text-base"
          />
        </div>
      </section>

      {/* Coming up + drafts */}
      <section aria-labelledby="coming-up">
        <h2 id="coming-up" className="section-title">
          Coming up and in progress
          <span className="ml-2 text-sm font-normal text-slate-500">{comingUp.length}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-500">Soonest cook date first. Open one to keep planning.</p>
        {comingUp.length === 0 ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="text-base font-semibold text-slate-700">Nothing planned yet</p>
            <p className="mt-1 text-sm text-slate-500">Use &ldquo;+ Plan a menu&rdquo; to start one.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {comingUp.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section aria-labelledby="past-menus">
          <h2 id="past-menus" className="section-title">
            Past menus
            <span className="ml-2 text-sm font-normal text-slate-500">{past.length}</span>
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {past.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        </section>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-base font-bold text-slate-500 [&::-webkit-details-marker]:hidden">
            <svg aria-hidden="true" className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            Replaced menus ({archived.length})
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        </details>
      )}

      {/* Add a menu to a cook date that already exists */}
      <section className="panel p-6">
        <h2 className="section-title">Add a menu to an existing cook date</h2>
        <p className="mt-1 text-sm text-slate-500">
          For a cook date that&apos;s already on the calendar. You&apos;ll add dishes on the next screen.
        </p>
        <form action={createProposal} className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <select className="field" name="cookDateId" required defaultValue="">
            <option disabled value="">
              Select a cook date
            </option>
            {cookDates.map((cookDate) => (
              <option key={cookDate.id} value={cookDate.id}>
                {cookDate.client.firstName} {cookDate.client.lastName} ·{" "}
                {formatDateShort(cookDate.scheduledFor)}
              </option>
            ))}
          </select>
          <input className="field" name="title" placeholder="Menu title" required />
          <button className="button-secondary" type="submit">
            Create menu
          </button>
        </form>
      </section>
    </div>
  );
}
