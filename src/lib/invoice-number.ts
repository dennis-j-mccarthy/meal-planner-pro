import { prisma } from "@/lib/prisma";

/**
 * Generate the next invoice number in MM-#### format.
 * Finds the highest sequential number across all invoices and increments.
 * The MM prefix is the current month.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  const latest = await prisma.invoice.findFirst({
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });

  let nextSeq = 1016; // Continues from spec's last known: 04-1015

  if (latest) {
    const match = latest.invoiceNumber.match(/-(\d+)$/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  return `${month}-${String(nextSeq).padStart(4, "0")}`;
}
