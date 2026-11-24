import { ClientList } from "@/components/client-list";
import { AddClientModal } from "@/components/add-client-modal";
import { formatWeekdayShort, todayStart } from "@/lib/dates";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

export default async function ClientsPage() {
  const kitchen = await requireKitchen();
  const start = todayStart();

  const clients = await prisma.client.findMany({
    where: { kitchenId: kitchen.id },
    include: {
      // The soonest upcoming cook date only.
      cookDates: {
        where: { scheduledFor: { gte: start }, status: { not: "CANCELLED" } },
        select: { scheduledFor: true },
        orderBy: { scheduledFor: "asc" },
        take: 1,
      },
      invoices: {
        where: { status: { in: ["DRAFT", "SENT"] }, archivedAt: null },
        select: { lineItems: { select: { amount: true } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = clients.map((client) => ({
    id: client.id,
    name: `${client.firstName} ${client.lastName}`.trim(),
    firstName: client.firstName,
    lastName: client.lastName,
    avatarUpdatedAt: client.avatarUpdatedAt?.getTime() ?? null,
    active: client.active,
    nextCookDateLabel: client.cookDates[0]
      ? formatWeekdayShort(client.cookDates[0].scheduledFor)
      : null,
    notMarkedPaid: client.invoices.reduce(
      (sum, inv) => sum + inv.lineItems.reduce((s, li) => s + li.amount, 0),
      0,
    ),
  }));

  // Active clients first, then inactive.
  rows.sort((a, b) => Number(b.active) - Number(a.active));

  return (
    <div className="mx-auto max-w-4xl space-y-6 fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="mt-1 text-sm muted">
            Households, dietary requirements, and service context · {rows.length} client{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <AddClientModal />
      </header>

      <ClientList clients={rows} />
    </div>
  );
}
