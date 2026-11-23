import { NextRequest, NextResponse } from "next/server";
import { requireKitchenApi } from "@/lib/guard";
import { loadBonAppetitHtml } from "@/lib/bon-appetit-html";
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

  const loaded = await loadBonAppetitHtml(menuCardId, kitchen.id);
  if (!loaded) {
    return NextResponse.json({ error: "Menu card not found" }, { status: 404 });
  }
  const { menuCard, html } = loaded;

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
