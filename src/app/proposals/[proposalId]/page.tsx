import { CalendarCheck, MessageSquareText } from "lucide-react";
import { ClientRate } from "@/components/client-rate";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { approveProposal, requestProposalRevision } from "@/app/actions";
import { ApproveButton } from "@/components/approve-button";
import { MenuPlanner } from "@/components/planner/menu-planner";
import { isEditableStatus, safetyChips } from "@/components/planner/planner-logic";
import {
  loadPlannerContext,
  loadPlannerDishes,
  plannerSearch,
  shortDate,
} from "@/components/planner/planner-server";
import { BTN_PRIMARY, BTN_QUIET, CARD, FOCUS } from "@/components/planner/ui";
import { ShareLinkBox } from "@/components/share-link-box";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

type ProposalDetailPageProps = {
  params: Promise<{ proposalId: string }>;
};

const LINK = `rounded-sm text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline ${FOCUS}`;

export default async function ProposalDetailPage({ params }: ProposalDetailPageProps) {
  const { proposalId } = await params;
  const kitchen = await requireKitchen();

  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, kitchenId: kitchen.id },
    select: {
      id: true,
      status: true,
      shareToken: true,
      sentAt: true,
      approvedAt: true,
      clientSubmittedAt: true,
      clientApproved: true,
      clientComment: true,
      cookDate: {
        select: {
          id: true,
          scheduledFor: true,
          guestCount: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              exclusions: true,
              dietaryNotes: true,
              defaultRate: true,
              travelFee: true,
            },
          },
          menuCards: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
      recipes: {
        where: { clientRemoved: true },
        select: { id: true, recipe: { select: { title: true } } },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!proposal) notFound();

  const ctx = await loadPlannerContext(kitchen.id, proposal.id);
  if (!ctx) notFound();

  const editable = isEditableStatus(proposal.status);
  const [dishes, search] = await Promise.all([
    loadPlannerDishes(ctx),
    editable
      ? plannerSearch(ctx, "", { safeOnly: true, notRecent: true, category: null })
      : Promise.resolve({ results: [], hidden: [] }),
  ]);

  const { cookDate } = proposal;
  const client = cookDate.client;
  const first = client.firstName;
  const guests = cookDate.guestCount;

  const crumb = (
    <>
      <Link href="/proposals" className={LINK}>
        Meal Planner
      </Link>
      <span aria-hidden="true"> › </span>
      <Link href={`/clients/${client.id}`} className={LINK}>
        {client.firstName} {client.lastName}
      </Link>
      <span aria-hidden="true"> · </span>
      <Link href={`/cook-dates/${cookDate.id}`} className={LINK}>
        {format(cookDate.scheduledFor, "EEEE, MMM d")}
      </Link>
      {guests ? (
        <>
          <span aria-hidden="true"> · </span>
          {guests} {guests === 1 ? "guest" : "guests"}
        </>
      ) : null}
      <span aria-hidden="true"> · </span>
      <ClientRate clientId={client.id} rate={client.defaultRate} travel={client.travelFee} />
    </>
  );

  // ---------------------------------------------------------------- status
  const removed = proposal.recipes.map((r) => ({ id: r.id, title: r.recipe.title }));
  const answered = !!proposal.clientSubmittedAt;
  const answeredOn = proposal.clientSubmittedAt ? shortDate(proposal.clientSubmittedAt) : "";
  const bonAppetitId = cookDate.menuCards[0]?.id ?? null;

  let statusPanel: React.ReactNode = null;
  if (proposal.status !== "DRAFT" || answered) {
    let pill: string;
    let tone: string;
    let line: string;
    switch (proposal.status) {
      case "SENT":
        if (answered && proposal.clientApproved) {
          pill = `${first} approved`;
          tone = "bg-emerald-50 text-emerald-700";
          line = `${first} approved this menu on ${answeredOn}. Mark it approved to make the Bon Appetit.`;
        } else if (answered) {
          pill = `${first} wants changes`;
          tone = "bg-amber-50 text-amber-800";
          line = `${first} asked for changes on ${answeredOn}. Choose “Client wants changes” to edit the menu and send an update.`;
        } else {
          pill = "Sent";
          tone = "bg-sky-50 text-sky-700";
          line = `Sent${proposal.sentAt ? ` ${shortDate(proposal.sentAt)}` : ""}. Waiting for ${first} — if they answer by text or phone, record it here.`;
        }
        break;
      case "REVISIONS_REQUESTED":
        pill = `${first} wants changes`;
        tone = "bg-amber-50 text-amber-800";
        line = "Change the menu below, then send the updated menu.";
        break;
      case "APPROVED":
        pill = "Approved";
        tone = "bg-emerald-50 text-emerald-700";
        line = `Approved${proposal.approvedAt ? ` ${shortDate(proposal.approvedAt)}` : ""}. This menu is final; make any late changes on the Bon Appetit.`;
        break;
      case "ARCHIVED":
        pill = "Replaced";
        tone = "bg-slate-100 text-slate-600";
        line = "Another menu was approved for this cook date, so this one is kept for history only.";
        break;
      default:
        pill = answered ? (proposal.clientApproved ? `${first} approved` : `${first} wants changes`) : "Draft";
        tone = "bg-slate-100 text-slate-600";
        line = "";
    }

    const canAnswer = proposal.status === "SENT" || proposal.status === "REVISIONS_REQUESTED";
    statusPanel = (
      <section aria-label="Client answer" className={`${CARD} p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{pill}</span>
            {line && <p className="mt-2 text-sm text-slate-600">{line}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canAnswer && (
              <form action={approveProposal}>
                <input type="hidden" name="proposalId" value={proposal.id} />
                <ApproveButton className={BTN_PRIMARY} />
              </form>
            )}
            {proposal.status === "SENT" && (
              <form action={requestProposalRevision}>
                <input type="hidden" name="proposalId" value={proposal.id} />
                <button type="submit" className={BTN_QUIET}>
                  <MessageSquareText aria-hidden="true" />
                  Client wants changes
                </button>
              </form>
            )}
            {proposal.status === "APPROVED" && bonAppetitId && (
              <Link href={`/cook-dates/${proposal.cookDate.id}`} className={BTN_PRIMARY}>
                <CalendarCheck aria-hidden="true" />
                Back to the cook date
              </Link>
            )}
          </div>
        </div>

        {answered && (proposal.clientComment || removed.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {proposal.clientComment && (
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">{first}&apos;s note</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{proposal.clientComment}</p>
              </div>
            )}
            {removed.length > 0 && (
              <div className="rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">
                  {first} skipped {removed.length} {removed.length === 1 ? "dish" : "dishes"}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {removed.map((r) => (
                    <li key={r.id} className="text-sm text-slate-700 line-through decoration-rose-400">
                      {r.title}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-xs text-slate-500">Skipped dishes are left off the Bon Appetit.</p>
              </div>
            )}
          </div>
        )}
        {answered && !proposal.clientComment && removed.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">No note, and no dishes skipped.</p>
        )}

        {proposal.status === "SENT" && proposal.shareToken && (
          <div className="mt-4">
            <ShareLinkBox token={proposal.shareToken} proposalId={proposal.id} clientHasEmail={!!client.email} />
          </div>
        )}
      </section>
    );
  }

  const favoriteCount = [...ctx.timesKept.keys()].filter((id) => !ctx.menuRecipeIds.has(id)).length;

  return (
    <MenuPlanner
      proposalId={proposal.id}
      cookDateId={cookDate.id}
      status={proposal.status}
      editable={editable}
      shareToken={proposal.shareToken}
      firstName={first}
      clientEmail={client.email}
      crumb={crumb}
      dateLabel={format(cookDate.scheduledFor, "EEEE, MMMM d")}
      statusPanel={statusPanel}
      quota={ctx.quota}
      safety={safetyChips(client.exclusions, client.dietaryNotes)}
      initialDishes={dishes}
      initialResults={search.results}
      lastMenuLabel={ctx.lastMenu ? shortDate(ctx.lastMenu.date) : null}
      favoriteCount={favoriteCount}
    />
  );
}
