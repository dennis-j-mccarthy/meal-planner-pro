import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";
import { buildInvoiceHtml } from "@/lib/invoice-template";
import { buildEml } from "@/lib/eml-builder";
import { format } from "date-fns";

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

  const clientName = `${invoice.client.firstName} ${invoice.client.lastName}`;
  const dateFormatted = format(invoice.invoiceDate, "M/d/yyyy");
  const total = invoice.lineItems.reduce((sum, li) => sum + li.amount, 0);
  const pdfFilename = `${invoice.client.lastName}_Invoice_${invoice.invoiceNumber}.pdf`;

  // Generate PDF
  const html = buildInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: dateFormatted,
    clientName,
    clientAddress: invoice.client.address,
    lineItems: invoice.lineItems.map((li) => ({
      description: li.description,
      amount: li.amount,
    })),
    remarks: invoice.remarks,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let pdfBuffer: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "Letter", printBackground: true });
    pdfBuffer = Buffer.from(pdf);
  } finally {
    await browser.close();
  }

  // Build .eml
  const eml = buildEml({
    from: "dennisjmccarthy@gmail.com",
    to: "yogabeth@mac.com",
    subject: `Invoice: ${invoice.client.lastName} - ${dateFormatted}`,
    body: [
      `Hi Beth,`,
      ``,
      `Here's the invoice for ${clientName}.`,
      ``,
      `Invoice #${invoice.invoiceNumber}`,
      `Total: $${total.toFixed(2)}`,
      ``,
      `Let me know if you need anything else!`,
      ``,
      `Dennis`,
    ].join("\n"),
    attachmentFilename: pdfFilename,
    attachmentPdf: pdfBuffer,
  });

  const emlFilename = `${invoice.client.lastName}_Invoice_${invoice.invoiceNumber}.eml`;

  return new NextResponse(eml, {
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="${emlFilename}"`,
    },
  });
}
