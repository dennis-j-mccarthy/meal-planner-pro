import { notFound } from "next/navigation";
import { TasteView } from "@/app/taste/[token]/taste-view";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { parseTasteDishes, tasteDishesForCookDate } from "@/lib/taste";

export const metadata = {
  title: "Preview: How did it taste?",
};

// The chef's preview of the "How did it taste?" page: the same page, every
// button works, nothing is saved or sent. Signed in, scoped to the kitchen.
export default async function PreviewTastePage({ params }: { params: Promise<{ cookDateId: string }> }) {
  const { cookDateId } = await params;
  const kitchen = await requireKitchen();
  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId: kitchen.id },
    select: {
      scheduledFor: true,
      client: { select: { firstName: true } },
      kitchen: { select: { id: true, name: true } },
      tasteFeedback: { select: { overall: true, comment: true, dishes: true } },
    },
  });
  if (!cookDate) notFound();

  const menu = await tasteDishesForCookDate(cookDateId, kitchen.id);
  const saved = new Map(parseTasteDishes(cookDate.tasteFeedback?.dishes).map((d) => [d.recipeId, d.rating]));

  return (
    <TasteView
      kitchen={cookDate.kitchen}
      firstName={cookDate.client.firstName}
      scheduledFor={cookDate.scheduledFor}
      token="preview"
      dishes={menu.map((d) => ({ ...d, rating: saved.get(d.recipeId) ?? null }))}
      initialOverall={cookDate.tasteFeedback?.overall ?? null}
      initialComment={cookDate.tasteFeedback?.comment ?? ""}
      alreadySubmitted={false}
      previewNote={`Preview of what ${cookDate.client.firstName} sees. Buttons work here; nothing is saved or sent.`}
    />
  );
}
