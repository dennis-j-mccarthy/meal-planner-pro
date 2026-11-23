// Record a payment on an invoice: PAID, when, how, and how much. Shared by the
// in-app "Record payment" form and "Paid Zelle" email replies. Scoped to the
// kitchen passed in.
import { prisma } from "@/lib/prisma";

export type PaymentResult =
  | { ok: true; invoiceNumber: string; method: string; paidAt: Date }
  | { ok: false; reason: "not-found" | "already-paid" | "void"; paidMethod?: string | null; paidAt?: Date | null };

export async function recordPayment(opts: {
  kitchenId: string;
  // One of these identifies the invoice.
  invoiceId?: string;
  invoiceNumber?: string;
  method: string;
  note: string | null;
  /** When it was paid. Defaults to now. */
  paidAt?: Date;
}): Promise<PaymentResult> {
  if (!opts.invoiceId && !opts.invoiceNumber) return { ok: false, reason: "not-found" };
  const invoice = await prisma.invoice.findFirst({
    where: {
      kitchenId: opts.kitchenId,
      ...(opts.invoiceId ? { id: opts.invoiceId } : { invoiceNumber: opts.invoiceNumber }),
    },
    include: { lineItems: { select: { amount: true } } },
  });
  if (!invoice) return { ok: false, reason: "not-found" };
  if (invoice.status === "PAID") {
    return { ok: false, reason: "already-paid", paidMethod: invoice.paidMethod, paidAt: invoice.paidAt };
  }
  if (invoice.status === "VOID") return { ok: false, reason: "void" };

  const paidAt = opts.paidAt ?? new Date();
  await prisma.invoice.updateMany({
    where: { id: invoice.id, kitchenId: opts.kitchenId },
    data: {
      status: "PAID",
      paidAt,
      paidMethod: opts.method,
      paidNote: opts.note,
      paidAmount: invoice.lineItems.reduce((s, li) => s + li.amount, 0),
    },
  });
  return { ok: true, invoiceNumber: invoice.invoiceNumber, method: opts.method, paidAt };
}
