import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireKitchenApi } from "@/lib/guard";
import { buildBonAppetitHtml } from "@/lib/bon-appetit-template";
import { bonAppetitNutrition } from "@/lib/recipe-facts";
import { generatePdfFromHtml } from "@/lib/generate-pdf";
import { format } from "date-fns";

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ menuCardId: string }> },
) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { menuCardId } = await params;

  const menuCard = await prisma.menuCard.findFirst({
    where: { id: menuCardId, kitchenId: kitchen.id },
    include: {
      client: true,
      recipes: {
        orderBy: { position: "asc" },
        include: { recipe: true },
      },
    },
  });

  if (!menuCard) {
    return NextResponse.json({ error: "Menu card not found" }, { status: 404 });
  }

  const html = buildBonAppetitHtml({
    ...(await bonAppetitNutrition(menuCard.id, kitchen.id)),
    clientFirstNames: menuCard.client.firstName,
    menuDate: format(menuCard.menuDate, "MMMM d, yyyy"),
    isCoaching: menuCard.isCoaching,
    recipes: menuCard.recipes.map((mr) => ({
      title: mr.recipe.title,
      description: mr.recipe.description,
      category: mr.category,
      ingredientsText: mr.recipe.ingredientsText,
      instructionsText: mr.recipe.instructionsText,
    })),
  });

  const pdfBuffer = await generatePdfFromHtml(html);
  const dateStr = format(menuCard.menuDate, "MM-dd-yyyy");
  const filename = `BonAppetit_${menuCard.client.lastName}_${dateStr}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
