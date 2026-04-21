import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInvoiceHtml } from "@/lib/invoice-template";
import { generatePdfFromHtml } from "@/lib/generate-pdf";
import { format } from "date-fns";

export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      lineItems: { orderBy: { position: "asc" } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const clientName = [invoice.client.firstName, invoice.client.lastName]
    .filter(Boolean)
    .join(" ");

  const html = buildInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: format(invoice.invoiceDate, "M/d/yyyy"),
    clientName,
    clientAddress: invoice.client.address,
    lineItems: invoice.lineItems.map((li) => ({
      description: li.description,
      amount: li.amount,
    })),
    remarks: invoice.remarks,
  });

  const pdfBuffer = await generatePdfFromHtml(html);
  const filename = `${invoice.client.lastName}_Invoice_${invoice.invoiceNumber}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
