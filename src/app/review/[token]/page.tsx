import { ClientNotice, ClientPageShell } from "@/components/client-page-shell";
import { prisma } from "@/lib/prisma";
import { REVIEW_SELECT, ReviewView } from "./review-view";

export const metadata = {
  title: "Your menu",
};

type ReviewPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { token } = await params;

  // Token-only lookup: this page is public and never kitchen-scoped.
  const proposal = await prisma.proposal.findUnique({
    where: { shareToken: token },
    select: REVIEW_SELECT,
  });

  if (!proposal) {
    return (
      <ClientPageShell kitchenId={null}>
        <ClientNotice title="This link is no longer active">
          Please reach out to your chef for an up-to-date menu link.
        </ClientNotice>
      </ClientPageShell>
    );
  }

  return <ReviewView proposal={proposal} token={token} />;
}
