import { prisma } from "@/lib/prisma";
import { LIVE_KITCHEN_ID } from "@/lib/inbound-mail";

/**
 * Generate the next invoice number for a kitchen.
 *
 * Each kitchen counts on from its own latest invoice, so test kitchens never
 * use up Beth's numbers. Beth's kitchen: MM-#### (continuing from 04-1015).
 * Every other kitchen: MM-T#### so its numbers can never match hers
 * (Invoice.invoiceNumber is unique across all kitchens). The MM prefix is the
 * current month.
 *
 * This is a read, not a reservation: two concurrent callers can get the same
 * number. Anything that writes an invoice should go through
 * createWithInvoiceNumber() below, which retries on the unique constraint.
 * `bump` skips ahead that many numbers (used by the retry).
 */
export async function getNextInvoiceNumber(kitchenId: string, bump = 0): Promise<string> {
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const live = kitchenId === LIVE_KITCHEN_ID;

  const latest = await prisma.invoice.findFirst({
    where: { kitchenId },
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });

  let nextSeq = live ? 1016 : 1001; // Beth's continues from spec's last known: 04-1015

  if (latest) {
    const match = latest.invoiceNumber.match(/-T?(\d+)$/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  return `${month}-${live ? "" : "T"}${String(nextSeq + bump).padStart(4, "0")}`;
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
 * Allocates an invoice number for the kitchen and runs `create` with it.
 * Invoice.invoiceNumber is @unique, so if a concurrent request took the same
 * number the insert fails with P2002 — re-read the latest number and try the
 * next one along (a few times).
 */
export async function createWithInvoiceNumber<T>(
  kitchenId: string,
  create: (invoiceNumber: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const invoiceNumber = await getNextInvoiceNumber(kitchenId, attempt - 1);
    try {
      return await create(invoiceNumber);
    } catch (error) {
      if (!isUniqueViolation(error) || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}
