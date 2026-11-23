// Save an emailed Bon Appetit in the app: match the client, attach it to that
// day's cook date (creating one if needed), reuse or create a Recipe per dish,
// and create the MenuCard. Webhooks have no signed-in user, so the kitchen is
// passed explicitly and every query is scoped to it.
import { prisma } from "@/lib/prisma";
import type { Dish } from "@/lib/menu-parser";
import { matchClient } from "@/lib/inbound-invoice";
import { findOrCreateCookDate } from "@/lib/cook-date-match";

export async function saveEmailedMenu(opts: {
  kitchenId: string;
  subjectClient: string;
  date: Date;
  monthOnly: boolean;
  dishes: Dish[];
  notes: string[];
}): Promise<
  | { ok: true; menuCardId: string; reused: boolean }
  | { ok: false; error: string }
> {
  const { kitchenId } = opts;

  const clients = await prisma.client.findMany({
    where: { kitchenId, active: true },
    select: { id: true, firstName: true, lastName: true },
  });
  const match = matchClient(opts.subjectClient, clients);
  if ("error" in match) {
    return { ok: false, error: `no client matched “${opts.subjectClient}”` };
  }
  const client = match.client;

  // Webhook re-delivery: the same menu saved for this client in the last 15
  // minutes is this email again.
  const recent = await prisma.menuCard.findFirst({
    where: {
      kitchenId,
      clientId: client.id,
      menuDate: opts.date,
      source: "EMAIL",
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (recent) return { ok: true, menuCardId: recent.id, reused: true };

  // A month-only menu has no single cook date.
  const cookDateId = opts.monthOnly
    ? null
    : (
        await findOrCreateCookDate({
          kitchenId,
          clientId: client.id,
          date: opts.date,
          status: "APPROVED",
        })
      ).id;

  // Reuse a recipe whose title matches (trimmed, any case); otherwise add it
  // to the recipe library.
  const library = await prisma.recipe.findMany({
    where: { kitchenId },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
  const byTitle = new Map<string, string>();
  for (const r of library) {
    const key = r.title.trim().toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, r.id);
  }

  const items: { recipeId: string; category: string | null }[] = [];
  const used = new Set<string>();
  for (const dish of opts.dishes) {
    const title = dish.title.trim();
    if (!title) continue;
    const key = title.toLowerCase();
    let recipeId = byTitle.get(key);
    if (!recipeId) {
      const created = await prisma.recipe.create({
        data: {
          kitchenId,
          title,
          description: dish.description.trim() || null,
          tags: dish.category ? dish.category.toLowerCase() : null,
        },
        select: { id: true },
      });
      recipeId = created.id;
      byTitle.set(key, recipeId);
    }
    // One row per recipe on a card (unique menuCardId + recipeId).
    if (used.has(recipeId)) continue;
    used.add(recipeId);
    items.push({ recipeId, category: dish.category });
  }

  const menuCard = await prisma.menuCard.create({
    data: {
      kitchenId,
      clientId: client.id,
      cookDateId,
      title: `Bon Appetit, ${client.firstName || "Client"}!`,
      menuDate: opts.date,
      accepted: true,
      source: "EMAIL",
      notes: opts.notes.length ? opts.notes.join("\n") : null,
      recipes: {
        create: items.map((it, i) => ({
          recipeId: it.recipeId,
          position: i + 1,
          category: it.category,
        })),
      },
    },
    select: { id: true },
  });

  return { ok: true, menuCardId: menuCard.id, reused: false };
}
