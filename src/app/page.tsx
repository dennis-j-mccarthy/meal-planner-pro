import { startOfToday } from "date-fns";
import { StatCard } from "@/components/stat-card";
import { DashboardView } from "@/components/dashboard-view";
import { MarketingPage } from "@/components/marketing-page";
import { getKitchen } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  // Signed out: marketing page. Signed in: dashboard for their kitchen.
  const kitchen = await getKitchen();
  if (!kitchen) {
    return <MarketingPage />;
  }

  const today = startOfToday();
  const [clientCount, allCookDates, openProposalCount, invoices, clients] =
    await Promise.all([
      prisma.client.count({ where: { kitchenId: kitchen.id } }),
      prisma.cookDate.findMany({
        where: { kitchenId: kitchen.id },
        include: {
          client: true,
          finalizedProposal: true,
        },
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.proposal.count({
        where: {
          kitchenId: kitchen.id,
          status: { in: ["DRAFT", "SENT", "REVISIONS_REQUESTED"] },
        },
      }),
      prisma.invoice.findMany({
        where: { kitchenId: kitchen.id },
        include: {
          client: true,
          lineItems: { select: { amount: true } },
        },
        orderBy: { invoiceDate: "desc" },
      }),
      prisma.client.findMany({
        where: { kitchenId: kitchen.id, active: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);

  const upcomingCookDates = allCookDates.filter(
    (cd) => cd.scheduledFor >= today,
  );
  const unpaidCount = invoices.filter(
    (inv) => inv.status === "DRAFT" || inv.status === "SENT",
  ).length;
  const totalRevenue = invoices
    .filter((inv) => inv.status !== "VOID")
    .reduce(
      (sum, inv) => sum + inv.lineItems.reduce((s, li) => s + li.amount, 0),
      0,
    );

  return (
    <div className="space-y-8 fade-up">
      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard value={clientCount} label="Clients" hint="Active client households" color="orange" icon="users" />
        <StatCard value={upcomingCookDates.length} label="Upcoming cook dates" hint="Future service visits" color="blue" icon="calendar" />
        <StatCard value={openProposalCount} label="Open meal plans" hint="Drafts, sent, and revisions" color="purple" icon="menu" />
        <StatCard value={formatMoney(totalRevenue)} label="Total invoiced" hint={`${unpaidCount} unpaid`} color="green" icon="dollar" />
      </section>

      <DashboardView
        cookDates={allCookDates.map((cd) => ({
          id: cd.id,
          scheduledFor: cd.scheduledFor.toISOString(),
          startTimeLabel: cd.startTimeLabel,
          guestCount: cd.guestCount,
          status: cd.status,
          serviceNotes: cd.serviceNotes,
          clientName: `${cd.client.firstName} ${cd.client.lastName}`,
          proposalTitle: cd.finalizedProposal?.title ?? null,
        }))}
        invoices={invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate.toISOString(),
          status: inv.status,
          clientName: `${inv.client.firstName} ${inv.client.lastName}`,
          total: inv.lineItems.reduce((sum, li) => sum + li.amount, 0),
        }))}
        clients={clients}
      />
    </div>
  );
}
