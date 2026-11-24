"use server";

// Cook date editing and invoices made from cook dates (one per cook date, or
// one per month). Every action starts with requireKitchen() and scopes every
// read and write to that kitchen. Ids that arrive bound or in a form are
// untrusted: each is checked against the kitchen before anything is written.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { createWithInvoiceNumber } from "@/lib/invoice-number";
import { ensureCookDateInvoice } from "@/lib/cook-date-invoice";
import { formatMonthKey, monthRange, todayYmd } from "@/lib/dates";
import { cookDatesForMonth, findMonthlyInvoice, personalChefLine } from "@/lib/billing";
import { isMenuApproved } from "@/lib/cook-date-progress";

function text(formData: FormData, key: string) {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

/** Stored at noon on the day, like every other cook date and invoice date. */
function parseDateInput(value: string) {
  return new Date(`${value}T12:00:00`);
}

function isYmd(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateInput(value).getTime());
}

function revalidateBilling() {
  ["/", "/cook-dates", "/clients", "/invoices", "/money", "/proposals", "/menu-cards"].forEach((p) =>
    revalidatePath(p),
  );
  revalidatePath("/cook-dates/[cookDateId]", "page");
  revalidatePath("/clients/[clientId]", "page");
  revalidatePath("/invoices/[invoiceId]", "page");
}

// ---------------------------------------------------------------------------
// Cook date
// ---------------------------------------------------------------------------

/** Edit a cook date's day, time, guests and notes; mark it cancelled or not. */
export async function updateCookDate(formData: FormData) {
  const kitchen = await requireKitchen();
  const cookDateId = text(formData, "cookDateId");
  if (!cookDateId) throw new Error("Cook date not found");

  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId: kitchen.id },
    include: { proposals: { select: { status: true } } },
  });
  if (!cookDate) throw new Error("Cook date not found");

  const day = text(formData, "scheduledFor");
  if (!isYmd(day)) throw new Error("Choose the date");
  const scheduledFor = parseDateInput(day);

  const guestsRaw = text(formData, "guestCount");
  const guests = guestsRaw === null ? null : Number(guestsRaw);
  const guestCount = guests !== null && Number.isInteger(guests) && guests >= 0 ? guests : null;

  // Cancelled, or back from cancelled to where the menu stands.
  const cancelled = formData.get("cancelled") === "on";
  let status = cookDate.status;
  if (cancelled) {
    status = "CANCELLED";
  } else if (cookDate.status === "CANCELLED") {
    status = isMenuApproved(cookDate)
      ? "APPROVED"
      : cookDate.proposals.some((p) => p.status === "SENT" || p.status === "REVISIONS_REQUESTED")
        ? "PROPOSED"
        : "DRAFT";
  }

  const dayChanged = todayYmd(cookDate.scheduledFor) !== day;

  await prisma.$transaction([
    prisma.cookDate.updateMany({
      where: { id: cookDate.id, kitchenId: kitchen.id },
      data: {
        scheduledFor,
        startTimeLabel: text(formData, "startTimeLabel"),
        guestCount,
        serviceNotes: text(formData, "serviceNotes"),
        status,
      },
    }),
    // The Bon Appetit prints the cook date's day: keep it in step.
    ...(dayChanged
      ? [
          prisma.menuCard.updateMany({
            where: { cookDateId: cookDate.id, kitchenId: kitchen.id },
            data: { menuDate: scheduledFor },
          }),
        ]
      : []),
  ]);

  revalidateBilling();
}

// ---------------------------------------------------------------------------
// Invoices from cook dates
// ---------------------------------------------------------------------------

/**
 * One invoice for one cook date, linked to it: "Personal Chef – <day>" at the
 * client's rate (0 when unset, for Beth to fill in), Travel when the client
 * has a travel fee, and Groceries when she entered what she spent. Either way
 * (new, or the one it already has) it lands on the cook date's Invoice step.
 */
export async function createInvoiceForCookDate(cookDateId: string) {
  const kitchen = await requireKitchen();
  if (typeof cookDateId !== "string" || !cookDateId) throw new Error("Cook date not found");

  const cookDate = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId: kitchen.id },
    include: { client: true },
  });
  if (!cookDate || cookDate.client.kitchenId !== kitchen.id) throw new Error("Cook date not found");

  await ensureCookDateInvoice(kitchen.id, cookDate.id);
  revalidateBilling();
  redirect(`/cook-dates/${cookDate.id}?step=invoice`);
}

/**
 * One invoice for all of a client's cook dates in a month ("YYYY-MM",
 * Eastern): a "Personal Chef – <day>" line per cook date at the client's rate,
 * plus one "Travel × n" line when the client has a travel fee and one
 * "Groceries" line for what was spent across the month. Cook dates that
 * already have their own invoice are left off. If the month already has a
 * monthly invoice, that one opens instead. Made from a cook date, it lands back
 * on that cook date's Invoice step.
 */
export async function createMonthlyInvoice(clientId: string, monthKey: string, fromCookDateId?: string) {
  const kitchen = await requireKitchen();
  if (typeof clientId !== "string" || !clientId) throw new Error("Client not found");
  if (typeof monthKey !== "string" || !monthRange(monthKey)) throw new Error("Choose a month");

  const client = await prisma.client.findFirst({
    where: { id: clientId, kitchenId: kitchen.id },
  });
  if (!client) throw new Error("Client not found");

  const back =
    typeof fromCookDateId === "string" && fromCookDateId
      ? `/cook-dates/${encodeURIComponent(fromCookDateId)}?step=invoice`
      : null;
  const existing = await findMonthlyInvoice(kitchen.id, client.id, monthKey);
  if (existing) redirect(back ?? `/invoices/${existing.id}`);

  const month = await cookDatesForMonth(kitchen.id, client.id, monthKey);
  if (!month || month.included.length === 0) {
    throw new Error(
      `${client.firstName} has no cook dates to bill in ${formatMonthKey(monthKey)}.`,
    );
  }

  const rate = client.defaultRate ?? 0;
  const lines: { description: string; amount: number }[] = month.included.map((cd) => ({
    description: personalChefLine(cd.scheduledFor),
    amount: rate,
  }));
  if (client.travelFee && client.travelFee > 0) {
    const n = month.included.length;
    lines.push({ description: `Travel × ${n}`, amount: Math.round(client.travelFee * n * 100) / 100 });
  }
  const groceries = month.included.reduce((sum, cd) => sum + (cd.groceryCost ?? 0), 0);
  if (groceries > 0) {
    lines.push({ description: "Groceries", amount: Math.round(groceries * 100) / 100 });
  }

  const invoice = await createWithInvoiceNumber(kitchen.id, (invoiceNumber) =>
    prisma.invoice.create({
      data: {
        kitchenId: kitchen.id,
        clientId: client.id,
        cookDateId: null,
        billingPeriod: monthKey,
        invoiceNumber,
        invoiceDate: parseDateInput(todayYmd()),
        lineItems: {
          create: lines.map((l, i) => ({ ...l, position: i + 1 })),
        },
      },
    }),
  );

  revalidateBilling();
  redirect(back ?? `/invoices/${invoice.id}/edit`);
}
