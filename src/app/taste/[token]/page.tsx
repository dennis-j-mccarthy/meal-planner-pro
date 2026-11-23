import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { parseTasteDishes, tasteDishesForCookDate } from "@/lib/taste";
import { getThemeById } from "@/lib/themes";
import { TasteForm } from "./taste-form";

export const metadata = {
  title: "How did it taste?",
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
      <Shell kitchenId={null}>
        <div className="mt-8 rounded-[14px] border border-stone-200 bg-white p-6 text-center sm:p-8">
          <h1 className="text-xl text-stone-900" style={DISPLAY_FONT}>
            This link is no longer active
          </h1>
          <p className="mt-2 text-sm text-stone-600">Please reach out to your chef directly.</p>
        </div>
      </Shell>
    );
  }

  const menu = await tasteDishesForCookDate(feedback.cookDateId, feedback.kitchenId);
  const saved = new Map(parseTasteDishes(feedback.dishes).map((d) => [d.recipeId, d.rating]));
  const dishes = menu.map((d) => ({ ...d, rating: saved.get(d.recipeId) ?? null }));

  return (
    <Shell kitchenId={feedback.kitchen.id}>
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">
          {feedback.kitchen.name}
        </p>
        <h1 className="mt-3 text-3xl text-stone-900 sm:text-4xl" style={DISPLAY_FONT}>
          How did everything taste?
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          {feedback.client.firstName}, your meals from {format(feedback.cookDate.scheduledFor, "EEEE, MMMM d")}
        </p>
      </header>

      <TasteForm
        token={token}
        dishes={dishes}
        initialOverall={feedback.overall}
        initialComment={feedback.comment ?? ""}
        alreadySubmitted={!!feedback.submittedAt}
      />

      <p className="mt-10 text-center text-xs text-stone-500">{feedback.kitchen.name}</p>
    </Shell>
  );
}
