import { NextRequest, NextResponse } from "next/server";
import { requireKitchenApi } from "@/lib/guard";
import { loadInvoiceHtml } from "@/lib/invoice-html";

// The invoice as HTML, for the preview inside the cook date steps. Same page
// the PDF is printed from, without the wait for Chromium.
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

  return new NextResponse(loaded.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
