import { format } from "date-fns";
import { ClientPageShell, CLIENT_DISPLAY_FONT } from "@/components/client-page-shell";
import type { TasteRating } from "@/lib/taste-ratings";
import { TasteForm } from "./taste-form";

/** The survey page; also the chef's preview at /preview/taste/<cookDateId>. */
export function TasteView({
  kitchen,
  firstName,
  scheduledFor,
  token,
  dishes,
  initialOverall,
  initialComment,
  alreadySubmitted,
  previewNote,
}: {
  kitchen: { id: string; name: string };
  firstName: string;
  scheduledFor: Date;
  token: string;
  dishes: Array<{ recipeId: string; title: string; rating: TasteRating | null }>;
  initialOverall: number | null;
  initialComment: string;
  alreadySubmitted: boolean;
  previewNote?: React.ReactNode;
}) {
  return (
    <ClientPageShell kitchenId={kitchen.id} preview={previewNote}>
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">{kitchen.name}</p>
        <h1 className="mt-3 text-3xl text-stone-900 sm:text-4xl" style={CLIENT_DISPLAY_FONT}>
          How did everything taste?
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          {firstName}, your meals from {format(scheduledFor, "EEEE, MMMM d")}
        </p>
      </header>

      <TasteForm
        token={token}
        dishes={dishes}
        initialOverall={initialOverall}
        initialComment={initialComment}
        alreadySubmitted={alreadySubmitted}
        preview={!!previewNote}
      />

      <p className="mt-10 text-center text-xs text-stone-500">{kitchen.name}</p>
    </ClientPageShell>
  );
}
