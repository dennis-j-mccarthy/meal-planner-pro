import { prisma } from "@/lib/prisma";

/**
 * Generate the next invoice number in MM-#### format.
 * Finds the highest sequential number across all invoices and increments.
 * The MM prefix is the current month.
 *
 * This is a read, not a reservation: two concurrent callers can get the same
 * number. Anything that writes an invoice should go through
 * createWithInvoiceNumber() below, which retries on the unique constraint.
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

const MAX_ATTEMPTS = 5;

function isUniqueViolation(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

/**
 * Allocates an invoice number and runs `create` with it. Invoice.invoiceNumber
 * is @unique, so if a concurrent request took the same number the insert fails
 * with P2002 — re-read the latest number and try again (a few times).
 */
export async function createWithInvoiceNumber<T>(
  create: (invoiceNumber: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const invoiceNumber = await getNextInvoiceNumber();
    try {
      return await create(invoiceNumber);
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}
