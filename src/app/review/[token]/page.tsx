import { ProposalReviewForm } from "./proposal-review-form";
import { formatDateShort } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Your meal plan",
};

type ReviewPageProps = {
  params: Promise<{ token: string }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { token } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { shareToken: token },
    include: {
      kitchen: { select: { name: true } },
      cookDate: { include: { client: { select: { firstName: true } } } },
      recipes: {
        orderBy: { position: "asc" },
        include: { recipe: true },
      },
    },
  });

  if (!proposal) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">This link is no longer active</h1>
          <p className="mt-2 text-sm text-slate-500">
            Please reach out to your chef for an up-to-date meal plan link.
          </p>
        </div>
      </Shell>
    );
  }

  const firstName = proposal.cookDate.client.firstName;
  const alreadySubmitted = !!proposal.clientSubmittedAt;

  return (
    <Shell>
      {/* Header */}
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-strong,#b45309)]">
          {proposal.kitchen.name}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {proposal.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Proposed for {formatDateShort(proposal.cookDate.scheduledFor)}
        </p>
      </div>

      {proposal.introMessage && (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-600 shadow-sm">
          {proposal.introMessage}
        </p>
      )}

      {alreadySubmitted ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <h2 className="text-lg font-bold text-emerald-800">
            Thanks, {firstName}! We&apos;ve got your notes.
          </h2>
          <p className="mt-2 text-sm text-emerald-700">
            Your chef will review your response and follow up. You can close this page.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm text-slate-600">
            Hi {firstName} — here&apos;s your proposed plan. There are a few extra dishes, so
            feel free to <strong>remove anything you&apos;d like to skip</strong>, add a
            comment, then approve or ask for changes.
          </p>

          <ProposalReviewForm
            token={token}
            recipes={proposal.recipes.map((pr) => ({
              id: pr.id,
              title: pr.recipe.title,
              description: pr.recipe.description,
              cuisine: pr.recipe.cuisine,
              imageUrl: pr.recipe.imageUrl,
              courseLabel: pr.courseLabel,
            }))}
          />
        </>
      )}

      <p className="mt-8 text-center text-xs text-slate-400">
        Powered by {proposal.kitchen.name}
      </p>
    </Shell>
  );
}
