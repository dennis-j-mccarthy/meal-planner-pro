import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBonAppetitHtml } from "@/lib/bon-appetit-template";
import { buildEml } from "@/lib/eml-builder";
import { generatePdfFromHtml } from "@/lib/generate-pdf";
import { format } from "date-fns";

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ menuCardId: string }> },
) {
  const { menuCardId } = await params;

  const menuCard = await prisma.menuCard.findUnique({
    where: { id: menuCardId },
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

  const dateFormatted = format(menuCard.menuDate, "M/d/yyyy");
  const dateLong = format(menuCard.menuDate, "MMMM d, yyyy");
  const dateFile = format(menuCard.menuDate, "MM-dd-yyyy");
  const pdfFilename = `BonAppetit_${menuCard.client.lastName}_${dateFile}.pdf`;

  // Generate PDF
  const html = buildBonAppetitHtml({
    clientFirstNames: menuCard.client.firstName,
    menuDate: dateLong,
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

  // Build recipe list for email body
  const recipeList = menuCard.recipes
    .map((mr) => `  * ${mr.recipe.title}`)
    .join("\n");

  const clientName = `${menuCard.client.firstName} ${menuCard.client.lastName}`;

  const eml = buildEml({
    from: "dennisjmccarthy@gmail.com",
    to: "yogabeth@mac.com",
    subject: `Bon Appetit - ${menuCard.client.firstName} - ${dateFormatted}`,
    body: [
      `Hi Beth,`,
      ``,
      `Here's the Bon Appetit for ${clientName}.`,
      ``,
      `This week's menu:`,
      recipeList,
      ``,
      `Dennis`,
    ].join("\n"),
    attachmentFilename: pdfFilename,
    attachmentPdf: pdfBuffer,
  });

  const emlFilename = `BonAppetit_${menuCard.client.lastName}_${dateFile}.eml`;

  return new NextResponse(eml, {
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="${emlFilename}"`,
    },
  });
}
