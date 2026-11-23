import { format } from "date-fns";
import { parseDishQuota, totalDishes } from "@/lib/dish-quota";
import { prisma } from "@/lib/prisma";
import { getThemeById } from "@/lib/themes";
import { FinalMenu, ProposalReviewForm, type ReviewRecipe } from "./proposal-review-form";

export const metadata = {
  title: "Your menu",
};

type ReviewPageProps = {
  params: Promise<{ token: string }>;
};

const DISPLAY_FONT = { fontFamily: "var(--font-display, Georgia, 'Times New Roman', serif)" } as const;

function Shell({ kitchenId, children }: { kitchenId: string | null; children: React.ReactNode }) {
  // The client has no theme cookie: use the kitchen's own colors.
  const theme = getThemeById(kitchenId === "kitchen_jwb" ? "jwb" : undefined);
  const style = {
    "--accent": theme.accent,
    "--accent-strong": theme.accentStrong,
    "--accent-light": theme.accentLight,
  } as React.CSSProperties;
  return (
    <div style={style} className="min-h-screen bg-[#faf9f7] px-4 py-10 text-stone-900">
      <main className="mx-auto max-w-2xl">{children}</main>
    </div>
  );
}

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-[14px] border border-stone-200 bg-white p-6 text-center sm:p-8">
      <h2 className="text-xl text-stone-900" style={DISPLAY_FONT}>
        {title}
      </h2>
      {children && <div className="mt-2 text-sm text-stone-600">{children}</div>}
    </div>
  );
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { token } = await params;

  // Token-only lookup: this page is public and never kitchen-scoped. Only the
  // client's first name and their dish count leave the server.
  const proposal = await prisma.proposal.findUnique({
    where: { shareToken: token },
    select: {
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
    },
  });

  if (!proposal) {
    return (
      <Shell kitchenId={null}>
        <Notice title="This link is no longer active">
          Please reach out to your chef for an up-to-date menu link.
        </Notice>
      </Shell>
    );
  }

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
    body = <Notice title="This menu has been replaced">{chef} will send you the latest one.</Notice>;
  } else if (proposal.status === "APPROVED") {
    body = (
      <>
        <Notice title={`You're all set, ${firstName}`}>Here&apos;s your menu for {dateLabel}.</Notice>
        <FinalMenu recipes={kept} />
      </>
    );
  } else if (proposal.clientSubmittedAt && proposal.clientApproved) {
    body = (
      <>
        <Notice title={`Thank you, ${firstName}!`}>
          You approved this menu. {chef} has your choices.
        </Notice>
        <FinalMenu recipes={kept} />
      </>
    );
  } else if (proposal.clientSubmittedAt || proposal.status === "REVISIONS_REQUESTED") {
    body = (
      <Notice title={`Thank you, ${firstName}!`}>{chef} will send an updated menu.</Notice>
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
          recipes={recipes}
          keepTarget={keepTarget}
          chef={chef}
          firstName={firstName}
        />
      </>
    );
  }

  return (
    <Shell kitchenId={kitchen.id}>
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
          {kitchen.name}
        </p>
        <h1 className="mt-3 text-3xl text-stone-900 sm:text-4xl" style={DISPLAY_FONT}>
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
    </Shell>
  );
}
