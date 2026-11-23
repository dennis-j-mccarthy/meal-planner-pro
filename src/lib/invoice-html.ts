// The invoice page for a saved invoice, as HTML. One builder for the in-app
// preview, the PDF and the copy emailed to the client.
//
// Deliberately NOT a "use server" module. The lookup is scoped to the kitchen
// passed in.
import { format } from "date-fns";
import { buildInvoiceHtml } from "@/lib/invoice-template";
import { prisma } from "@/lib/prisma";

export async function loadInvoiceHtml(invoiceId: string, kitchenId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, kitchenId },
    include: { client: true, lineItems: { orderBy: { position: "asc" } } },
  });
  if (!invoice) return null;

  const html = buildInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: format(invoice.invoiceDate, "M/d/yyyy"),
    clientName: [invoice.client.firstName, invoice.client.lastName].filter(Boolean).join(" "),
    clientAddress: invoice.client.address,
    lineItems: invoice.lineItems.map((li) => ({ description: li.description, amount: li.amount })),
    remarks: invoice.remarks,
    showGratuity: invoice.showGratuity,
  });
  return { invoice, html };
}
