import { createProposal } from "@/app/actions";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { formatDateShort, formatEnum } from "@/lib/format";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function ProposalsPage() {
  const kitchen = await getKitchen();
  const [cookDates, proposals] = await Promise.all([
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
  ]);

  const drafts = proposals.filter(
    (p) => p.status === "DRAFT" || p.status === "REVISIONS_REQUESTED",
  );
  const shared = proposals.filter((p) => p.status === "SENT");
  const approved = proposals.filter((p) => p.status === "APPROVED");
  const archived = proposals.filter((p) => p.status === "ARCHIVED");

  function ProposalCard({ proposal }: { proposal: (typeof proposals)[number] }) {
    const clientName = `${proposal.cookDate.client.firstName} ${proposal.cookDate.client.lastName}`;
    const recipeCount = proposal.recipes.length;

    return (
      <Link
        href={`/proposals/${proposal.id}`}
        className="block rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{proposal.title}</h3>
              <StatusBadge label={formatEnum(proposal.status)} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {clientName} · {formatDateShort(proposal.cookDate.scheduledFor)}
            </p>
            {recipeCount > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {proposal.recipes.slice(0, 4).map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500"
                  >
                    {item.recipe.title}
                  </span>
                ))}
                {recipeCount > 4 && (
                  <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-400">
                    +{recipeCount - 4} more
                  </span>
                )}
              </div>
            )}
            {recipeCount === 0 && (
              <p className="mt-1 text-xs text-slate-400">No recipes added yet</p>
            )}
          </div>
          <svg className="h-5 w-5 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Proposals</h1>
        <p className="mt-1 text-sm text-slate-500">
          Build menus for your clients. Create a draft, add recipes, then share it for approval.
        </p>
      </div>

      {/* Create form */}
      <section className="panel p-6">
        <h2 className="text-lg font-bold text-slate-900">New proposal</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick a cook date and give the proposal a name. You&apos;ll add recipes on the next screen.
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
          <input className="field" name="title" placeholder="Proposal title" required />
          <button className="button-primary" type="submit">
            Create draft
          </button>
        </form>
      </section>

      {/* Drafts — needs attention */}
      {drafts.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-slate-900">
            In progress ({drafts.length})
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Drafts and proposals needing changes — click to edit.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {drafts.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        </section>
      )}

      {/* Shared — waiting for client */}
      {shared.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-slate-900">
            Shared with client ({shared.length})
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Waiting for client approval or feedback.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shared.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        </section>
      )}

      {/* Approved */}
      {approved.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-slate-900">
            Approved ({approved.length})
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">Client-approved menus ready for cook day.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {approved.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        </section>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <section>
          <h2 className="text-base font-bold text-slate-500">
            Archived ({archived.length})
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {proposals.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          No proposals yet. Create one above to get started.
        </div>
      )}
    </div>
  );
}
