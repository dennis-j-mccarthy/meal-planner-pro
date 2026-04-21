import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";
import { buildBonAppetitHtml } from "@/lib/bon-appetit-template";
import { format } from "date-fns";

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

  const html = buildBonAppetitHtml({
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

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
    });

    const dateStr = format(menuCard.menuDate, "MM-dd-yyyy");
    const filename = `BonAppetit_${menuCard.client.lastName}_${dateStr}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } finally {
    await browser.close();
  }
}
