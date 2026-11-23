import { prisma } from "@/lib/prisma";
import { parseTasteDishes, tasteDishesForCookDate } from "@/lib/taste";
import { ClientNotice, ClientPageShell } from "@/components/client-page-shell";
import { TasteView } from "./taste-view";

export const metadata = {
  title: "How did it taste?",
};

export default async function TastePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Token-only lookup: this page is public and never kitchen-scoped. Only the
  // client's first name, the date and the dish names leave the server.
  const feedback = await prisma.tasteFeedback.findUnique({
    where: { token },
    select: {
      cookDateId: true,
      kitchenId: true,
      overall: true,
      comment: true,
      dishes: true,
      submittedAt: true,
      kitchen: { select: { id: true, name: true } },
      client: { select: { firstName: true } },
      cookDate: { select: { scheduledFor: true } },
    },
  });

  if (!feedback) {
    return (
      <ClientPageShell kitchenId={null}>
        <ClientNotice title="This link is no longer active">Please reach out to your chef directly.</ClientNotice>
      </ClientPageShell>
    );
  }

  const menu = await tasteDishesForCookDate(feedback.cookDateId, feedback.kitchenId);
  const saved = new Map(parseTasteDishes(feedback.dishes).map((d) => [d.recipeId, d.rating]));
  const dishes = menu.map((d) => ({ ...d, rating: saved.get(d.recipeId) ?? null }));

  return (
    <TasteView
      kitchen={feedback.kitchen}
      firstName={feedback.client.firstName}
      scheduledFor={feedback.cookDate.scheduledFor}
      token={token}
      dishes={dishes}
      initialOverall={feedback.overall}
      initialComment={feedback.comment ?? ""}
      alreadySubmitted={!!feedback.submittedAt}
    />
  );
}
