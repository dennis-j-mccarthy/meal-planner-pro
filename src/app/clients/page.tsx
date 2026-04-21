import { ClientList } from "@/components/client-list";
import { AddClientModal } from "@/components/add-client-modal";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function ClientsPage() {
  const kitchen = await getKitchen();
  const clients = await prisma.client.findMany({
    where: { kitchenId: kitchen.id },
    include: {
      cookDates: {
        include: {
          proposals: {
            select: { id: true, title: true, status: true },
            orderBy: { createdAt: "desc" },
          },
          menuCards: {
            select: { id: true, title: true, accepted: true },
            orderBy: { menuDate: "desc" },
          },
          finalizedProposal: { select: { id: true, title: true } },
        },
        orderBy: { scheduledFor: "desc" },
      },
      invoices: {
        include: { lineItems: { select: { amount: true } } },
        orderBy: { invoiceDate: "desc" },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const now = new Date();

  const clientData = clients.map((client) => {
    const nextCookDate = client.cookDates.find(
      (cd) => cd.scheduledFor >= now,
    );

    return {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      householdLabel: client.householdLabel,
      dietaryNotes: client.dietaryNotes,
      address: client.address,
      active: client.active,
      nextCookDate: nextCookDate?.scheduledFor.toISOString() ?? null,
      cookDateCount: client.cookDates.length,
      invoiceCount: client.invoices.length,
      cookDates: client.cookDates.map((cd) => ({
        id: cd.id,
        scheduledFor: cd.scheduledFor.toISOString(),
        status: cd.status,
        startTimeLabel: cd.startTimeLabel,
        hasApprovedMenu: cd.finalizedProposal !== null,
        approvedMenuTitle: cd.finalizedProposal?.title ?? null,
        proposals: cd.proposals.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
        })),
        bonAppetits: cd.menuCards.map((mc) => ({
          id: mc.id,
          title: mc.title,
          accepted: mc.accepted,
        })),
      })),
      invoices: client.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString(),
        status: inv.status,
        total: inv.lineItems.reduce((sum, li) => sum + li.amount, 0),
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Clients
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage households, dietary requirements, and service context.
          </p>
        </div>
        <AddClientModal />
      </div>

      <ClientList clients={clientData} />
    </div>
  );
}
