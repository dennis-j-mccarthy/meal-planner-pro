// The one-off invoice for a cook date: made by "Create invoice", and made or
// updated on its own as soon as Beth saves what she spent on groceries.
// Plain module (not "use server"); every query is scoped to the kitchen.
import { prisma } from "@/lib/prisma";
import { personalChefLine } from "@/lib/billing";
import { isMonthlyBilling } from "@/lib/cook-date-progress";
import { todayYmd } from "@/lib/dates";
import { createWithInvoiceNumber } from "@/lib/invoice-number";

const GROCERIES = /grocer/i;

function ownInvoice(kitchenId: string, cookDateId: string) {
  return prisma.invoice.findFirst({
    where: { kitchenId, cookDateId, status: { not: "VOID" }, archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, lineItems: { select: { id: true, description: true, position: true } } },
  });
}

/**
 * The cook date's own invoice, made if it has none: "Personal Chef – <day>"
 * at the client's rate (0 when unset), Travel when the client has a travel
 * fee, and Groceries when she entered what she spent.
 */
export async function ensureCookDateInvoice(kitchenId: string, cookDateId: string) {
  const existing = await ownInvoice(kitchenId, cookDateId);
  if (existing) return { id: existing.id, created: false };

  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId },
    include: { client: true },
  });
  if (!cookDate || cookDate.client.kitchenId !== kitchenId) throw new Error("Cook date not found");

  const { client } = cookDate;
  const lines: { description: string; amount: number }[] = [
    { description: personalChefLine(cookDate.scheduledFor), amount: client.defaultRate ?? 0 },
  ];
  if (client.travelFee && client.travelFee > 0) lines.push({ description: "Travel", amount: client.travelFee });
  if (cookDate.groceryCost && cookDate.groceryCost > 0) {
    lines.push({ description: "Groceries", amount: cookDate.groceryCost });
  }

  const invoice = await createWithInvoiceNumber(kitchenId, (invoiceNumber) =>
    prisma.invoice.create({
      data: {
        kitchenId,
        clientId: client.id,
        cookDateId: cookDate.id,
        invoiceNumber,
        invoiceDate: new Date(`${todayYmd()}T12:00:00`),
        lineItems: { create: lines.map((l, i) => ({ ...l, position: i + 1 })) },
      },
      select: { id: true },
    }),
  );
  return { id: invoice.id, created: true };
}

/**
 * After the groceries amount is saved: for a client billed per cook date,
 * make the invoice (when there is none and something was spent) or bring the
 * draft's Groceries line in line with the amount. Sent and paid invoices,
 * and monthly clients (one invoice for the month), are left alone.
 */
export async function syncCookDateGroceries(kitchenId: string, cookDateId: string) {
  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId },
    select: { groceryCost: true, status: true, client: { select: { billingMode: true } } },
  });
  if (!cookDate || cookDate.status === "CANCELLED" || isMonthlyBilling(cookDate.client.billingMode)) return null;
  const cost = cookDate.groceryCost && cookDate.groceryCost > 0 ? cookDate.groceryCost : null;

  const invoice = await ownInvoice(kitchenId, cookDateId);
  if (!invoice) return cost ? ensureCookDateInvoice(kitchenId, cookDateId) : null;
  if (invoice.status !== "DRAFT") return { id: invoice.id, created: false };

  const line = invoice.lineItems.find((li) => GROCERIES.test(li.description));
  if (line && cost) {
    await prisma.invoiceLineItem.update({ where: { id: line.id }, data: { amount: cost } });
  } else if (line && !cost) {
    await prisma.invoiceLineItem.delete({ where: { id: line.id } });
  } else if (!line && cost) {
    const last = Math.max(0, ...invoice.lineItems.map((li) => li.position));
    await prisma.invoiceLineItem.create({
      data: { invoiceId: invoice.id, description: "Groceries", amount: cost, position: last + 1 },
    });
  }
  return { id: invoice.id, created: false };
}
