// The Bon Appetit page for a saved menu card, as HTML. One builder for the
// in-app preview, the PDF and the copy emailed to the client.
//
// Deliberately NOT a "use server" module. The lookup is scoped to the kitchen
// passed in.
import { format } from "date-fns";
import { buildBonAppetitHtml } from "@/lib/bon-appetit-template";
import { prisma } from "@/lib/prisma";
import { bonAppetitNutrition } from "@/lib/recipe-facts";

export async function loadBonAppetitHtml(
  menuCardId: string,
  kitchenId: string,
  // monthOnly: the menu is for a month, not a day ("October, 2026").
  opts: { monthOnly?: boolean } = {},
) {
  const menuCard = await prisma.menuCard.findFirst({
    where: { id: menuCardId, kitchenId },
    include: {
      client: true,
      recipes: { orderBy: { position: "asc" }, include: { recipe: true } },
    },
  });
  if (!menuCard) return null;

  const fromEmail = menuCard.source === "EMAIL";
  const html = buildBonAppetitHtml({
    ...(await bonAppetitNutrition(menuCard.id, kitchenId)),
    clientFirstNames: menuCard.client.firstName,
    menuDate: format(menuCard.menuDate, opts.monthOnly ? "MMMM, yyyy" : "MMMM d, yyyy"),
    isCoaching: menuCard.isCoaching,
    // A menu that came in by email keeps Beth's section order and notes.
    ...(fromEmail
      ? {
          preserveOrder: true,
          notes: menuCard.notes ? menuCard.notes.split("\n").filter(Boolean) : [],
        }
      : {}),
    recipes: menuCard.recipes.map((mr) => ({
      title: mr.recipe.title,
      description: mr.recipe.description,
      category: mr.category,
      ingredientsText: mr.recipe.ingredientsText,
      instructionsText: mr.recipe.instructionsText,
    })),
  });
  return { menuCard, html };
}
