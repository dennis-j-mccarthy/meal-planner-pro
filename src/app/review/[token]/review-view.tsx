import { format } from "date-fns";
import type { Prisma } from "@/generated/prisma/client";
import { ClientNotice, ClientPageShell, CLIENT_DISPLAY_FONT } from "@/components/client-page-shell";
import { parseDishQuota, totalDishes } from "@/lib/dish-quota";
import { FinalMenu, ProposalReviewForm, type ReviewRecipe } from "./proposal-review-form";

// The client's menu review page. Rendered for the client at /review/<token>,
// and for the chef as a preview at /preview/review/<proposalId> (same page,
// buttons work, nothing is saved). Only the client's first name and their dish
// count leave the server.
export const REVIEW_SELECT = {
  introMessage: true,
  status: true,
  clientSubmittedAt: true,
  clientApproved: true,
  kitchen: { select: { id: true, name: true } },
  cookDate: {
    select: {
      scheduledFor: true,
      client: { select: { firstName: true, dishQuota: true } },
    },
  },
  recipes: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      courseLabel: true,
      clientRemoved: true,
      recipe: { select: { title: true, description: true, imageUrl: true } },
    },
  },
} satisfies Prisma.ProposalSelect;

export type ReviewProposal = Prisma.ProposalGetPayload<{ select: typeof REVIEW_SELECT }>;

export function ReviewView({
  proposal,
  token,
  previewNote,
}: {
  proposal: ReviewProposal;
  token: string;
  /** Set when the chef is previewing: shown in a bar above the page. */
  previewNote?: React.ReactNode;
}) {
  const kitchen = proposal.kitchen;
  const chef = kitchen.id === "kitchen_jwb" ? "Beth" : kitchen.name;
  const firstName = proposal.cookDate.client.firstName;
  const dateLabel = format(proposal.cookDate.scheduledFor, "EEEE, MMMM d");
  const recipes: ReviewRecipe[] = proposal.recipes.map((pr) => ({
    id: pr.id,
    title: pr.recipe.title,
    description: pr.recipe.description,
    imageUrl: pr.recipe.imageUrl,
    courseLabel: pr.courseLabel,
    clientRemoved: pr.clientRemoved,
  }));
  const kept = recipes.filter((r) => !r.clientRemoved);

  const quotaTotal = totalDishes(parseDishQuota(proposal.cookDate.client.dishQuota));
  const keepTarget = quotaTotal > 0 && quotaTotal < recipes.length ? quotaTotal : null;

  let body: React.ReactNode;
  if (proposal.status === "ARCHIVED") {
    body = <ClientNotice title="This menu has been replaced">{chef} will send you the latest one.</ClientNotice>;
  } else if (proposal.status === "APPROVED") {
    body = (
      <>
        <ClientNotice title={`You're all set, ${firstName}`}>Here&apos;s your menu for {dateLabel}.</ClientNotice>
        <FinalMenu recipes={kept} />
      </>
    );
  } else if (proposal.clientSubmittedAt && proposal.clientApproved) {
    body = (
      <>
        <ClientNotice title={`Thank you, ${firstName}!`}>
          You approved this menu. {chef} has your choices.
        </ClientNotice>
        <FinalMenu recipes={kept} />
      </>
    );
  } else if (proposal.clientSubmittedAt || proposal.status === "REVISIONS_REQUESTED") {
    body = (
      <ClientNotice title={`Thank you, ${firstName}!`}>{chef} will send an updated menu.</ClientNotice>
    );
  } else {
    body = (
      <>
        <p className="mt-8 text-[15px] leading-relaxed text-stone-700">
          Hi {firstName}!{" "}
          {keepTarget ? (
            <>
              <strong>
                Pick your favorite {keepTarget} of {recipes.length}
              </strong>{" "}
              &mdash; remove the ones you&apos;d skip, add a note if you like, then approve.
            </>
          ) : (
            <>
              <strong>Remove anything you&apos;d like to skip</strong>, add a note if you like, then
              approve or ask for changes.
            </>
          )}
        </p>
        <ProposalReviewForm
          token={token}
          preview={!!previewNote}
          recipes={recipes}
          keepTarget={keepTarget}
          chef={chef}
          firstName={firstName}
        />
      </>
    );
  }

  return (
    <ClientPageShell kitchenId={kitchen.id} preview={previewNote}>
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
          {kitchen.name}
        </p>
        <h1 className="mt-3 text-3xl text-stone-900 sm:text-4xl" style={CLIENT_DISPLAY_FONT}>
          Your menu for {dateLabel}
        </h1>
      </header>

      {proposal.introMessage && (
        <p className="mt-6 rounded-[14px] border border-stone-200 bg-white p-5 text-sm leading-relaxed text-stone-600">
          {proposal.introMessage}
        </p>
      )}

      {body}

      <p className="mt-10 text-center text-xs text-stone-500">{kitchen.name}</p>
    </ClientPageShell>
  );
}
