import Link from "next/link";
import { notFound } from "next/navigation";
import {
  approveProposal,
  requestProposalRevision,
  sendProposal,
} from "@/app/actions";
import { StatusBadge } from "@/components/status-badge";
import { ProposalRecipeManager } from "@/components/proposal-recipe-manager";
import { formatDateShort, formatEnum, formatMinutes } from "@/lib/format";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type ProposalDetailPageProps = {
  params: Promise<{
    proposalId: string;
  }>;
};

export default async function ProposalDetailPage({ params }: ProposalDetailPageProps) {
  const { proposalId } = await params;
  const kitchen = await getKitchen();

  const [proposal, allRecipes] = await Promise.all([
    prisma.proposal.findFirst({
      where: {
        id: proposalId,
        kitchenId: kitchen.id,
      },
      include: {
        cookDate: {
          include: {
            client: true,
            menuCards: { select: { id: true }, take: 1 },
            finalizedProposal: { select: { id: true } },
          },
        },
        recipes: {
          include: { recipe: true },
          orderBy: { position: "asc" },
        },
      },
    }),
    prisma.recipe.findMany({
      where: { kitchenId: kitchen.id },
      orderBy: { title: "asc" },
    }),
  ]);

  if (!proposal) {
    notFound();
  }

  const isApproved = proposal.status === "APPROVED";
  const isEditable = !isApproved;
  const canShare = proposal.status === "DRAFT" || proposal.status === "REVISIONS_REQUESTED";
  const canRequestChanges = proposal.status === "SENT" || proposal.status === "REVISIONS_REQUESTED";
  const canApprove = proposal.status === "SENT" || proposal.status === "DRAFT" || proposal.status === "REVISIONS_REQUESTED";

  const client = proposal.cookDate.client;
  const clientName = `${client.firstName} ${client.lastName}`;

  const recipesForManager = allRecipes.map((r) => ({
    id: r.id,
    title: r.title,
    cuisine: r.cuisine,
    tags: r.tags,
    description: r.description,
    ingredientsText: r.ingredientsText,
    instructionsText: r.instructionsText,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    servings: r.servings,
    imageUrl: r.imageUrl,
    starred: r.starred,
  }));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/clients" className="hover:text-slate-900">
          Clients
        </Link>
        <span>/</span>
        <Link
          href={`/clients/${client.id}`}
          className="hover:text-slate-900"
        >
          {clientName}
        </Link>
        <span>/</span>
        <Link
          href={`/cook-dates/${proposal.cookDateId}`}
          className="hover:text-slate-900"
        >
          {formatDateShort(proposal.cookDate.scheduledFor)}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Meal Plan</span>
      </div>



      {/* Header */}
      <section className="panel p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={formatEnum(proposal.status)} />
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {proposal.title}
            </h1>
            <p className="mt-2 text-base text-slate-600">
              {clientName} · {formatDateShort(proposal.cookDate.scheduledFor)}
            </p>
            {proposal.introMessage && (
              <p className="mt-3 max-w-2xl text-sm text-slate-500">{proposal.introMessage}</p>
            )}
            {proposal.revisionNotes && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Client feedback</p>
                <p className="mt-1 text-sm text-amber-800">{proposal.revisionNotes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 xl:min-w-48">
            {canShare && (
              <form action={sendProposal}>
                <input name="proposalId" type="hidden" value={proposal.id} />
                <button className="button-primary text-sm" type="submit">
                  Send to client
                </button>
              </form>
            )}
            {canApprove && (
              <form action={approveProposal}>
                <input name="proposalId" type="hidden" value={proposal.id} />
                <button
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  type="submit"
                >
                  Client approved
                </button>
              </form>
            )}
            {canRequestChanges && (
              <form action={requestProposalRevision}>
                <input name="proposalId" type="hidden" value={proposal.id} />
                <button className="button-secondary text-sm" type="submit">
                  Client wants changes
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Recipe management or recipe list */}
      <section className="panel p-6 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">
          Menu ({proposal.recipes.length} {proposal.recipes.length === 1 ? "recipe" : "recipes"})
        </h2>

        <div className="mt-4">
          <ProposalRecipeManager
            proposalId={proposal.id}
            currentRecipes={proposal.recipes.map((item) => ({
              id: item.id,
              recipeId: item.recipeId,
              courseLabel: item.courseLabel,
              recipe: {
                title: item.recipe.title,
                description: item.recipe.description,
                ingredientsText: item.recipe.ingredientsText,
                instructionsText: item.recipe.instructionsText,
                prepMinutes: item.recipe.prepMinutes,
                cookMinutes: item.recipe.cookMinutes,
                servings: item.recipe.servings,
                cuisine: item.recipe.cuisine,
                imageUrl: item.recipe.imageUrl,
              },
            }))}
            allRecipes={recipesForManager}
          />
        </div>
      </section>
    </div>
  );
}
