// Invoices for cook dates: one per cook date, or one per month for clients
// billed monthly. Plain module (not "use server"); every query is scoped to
// the kitchen passed in.
import { prisma } from "@/lib/prisma";
import { formatWeekdayLong, monthRange, todayYmd } from "@/lib/dates";

/** "2026-11" for the Eastern calendar month a stored date falls in. */
export function monthKeyOf(date: Date) {
  return todayYmd(date).slice(0, 7);
}

/** "Personal Chef – Monday, November 23" */
export function personalChefLine(date: Date) {
  return `Personal Chef – ${formatWeekdayLong(date)}`;
}

/**
 * The invoice that bills a cook date: one linked to it directly, else the
 * client's monthly invoice for that month. Void invoices don't count.
 */
export async function findCookDateInvoice(
  kitchenId: string,
  cookDate: { id: string; clientId: string; scheduledFor: Date },
) {
  const invoices = await prisma.invoice.findMany({
    where: {
      kitchenId,
      status: { not: "VOID" },
      OR: [
        { cookDateId: cookDate.id },
        { clientId: cookDate.clientId, billingPeriod: monthKeyOf(cookDate.scheduledFor) },
      ],
    },
    include: { lineItems: { select: { amount: true } } },
    orderBy: { createdAt: "desc" },
  });
  return invoices.find((inv) => inv.cookDateId === cookDate.id) ?? invoices[0] ?? null;
}

/** The client's monthly invoice for a month (not void), if there is one. */
export function findMonthlyInvoice(kitchenId: string, clientId: string, monthKey: string) {
  return prisma.invoice.findFirst({
    where: { kitchenId, clientId, billingPeriod: monthKey, status: { not: "VOID" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, invoiceNumber: true, status: true },
  });
}

/**
 * A client's non-cancelled cook dates in a month, split into the ones a
 * monthly invoice would bill and the ones that already have their own
 * invoice. Null when the month key is malformed.
 */
export async function cookDatesForMonth(kitchenId: string, clientId: string, monthKey: string) {
  const range = monthRange(monthKey);
  if (!range) return null;

  const cookDates = await prisma.cookDate.findMany({
    where: {
      kitchenId,
      clientId,
      scheduledFor: { gte: range.start, lt: range.end },
      status: { not: "CANCELLED" },
    },
    select: { id: true, scheduledFor: true, startTimeLabel: true },
    orderBy: { scheduledFor: "asc" },
  });

  const own = cookDates.length
    ? await prisma.invoice.findMany({
        where: {
          kitchenId,
          clientId,
          cookDateId: { in: cookDates.map((cd) => cd.id) },
          status: { not: "VOID" },
        },
        select: { id: true, invoiceNumber: true, cookDateId: true },
      })
    : [];
  const ownByCookDate = new Map(own.map((inv) => [inv.cookDateId, inv]));

  return {
    included: cookDates.filter((cd) => !ownByCookDate.has(cd.id)),
    alreadyInvoiced: cookDates
      .filter((cd) => ownByCookDate.has(cd.id))
      .map((cd) => ({ cookDate: cd, invoice: ownByCookDate.get(cd.id)! })),
  };
}
