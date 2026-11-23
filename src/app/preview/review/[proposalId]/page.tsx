import { notFound } from "next/navigation";
import { REVIEW_SELECT, ReviewView } from "@/app/review/[token]/review-view";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Preview: client's menu page",
};

// The chef's preview of the client's menu review page: the same page, every
// button works, nothing is saved or sent. Signed in, scoped to the kitchen.
export default async function PreviewReviewPage({ params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const kitchen = await requireKitchen();
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, kitchenId: kitchen.id },
    select: REVIEW_SELECT,
  });
  if (!proposal) notFound();

  return (
    <ReviewView
      proposal={proposal}
      token="preview"
      previewNote={`Preview of what ${proposal.cookDate.client.firstName} sees. Buttons work here; nothing is saved or sent.`}
    />
  );
}
