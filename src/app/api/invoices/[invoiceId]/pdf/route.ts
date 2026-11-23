import { NextRequest, NextResponse } from "next/server";
import { requireKitchenApi } from "@/lib/guard";
import { loadInvoiceHtml } from "@/lib/invoice-html";
import { generatePdfFromHtml } from "@/lib/generate-pdf";

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;
  const { invoiceId } = await params;

  const loaded = await loadInvoiceHtml(invoiceId, kitchen.id);
  if (!loaded) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  const { invoice, html } = loaded;

  const pdfBuffer = await generatePdfFromHtml(html);
  const filename = `${invoice.client.lastName}_Invoice_${invoice.invoiceNumber}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
