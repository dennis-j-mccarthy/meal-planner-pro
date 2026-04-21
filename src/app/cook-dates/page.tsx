import { CookDatesView } from "@/components/cook-dates-view";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function CookDatesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const kitchen = await getKitchen();
  const params = await searchParams;
  const preselectedClientId = params.clientId || "";
  const [clients, cookDates] = await Promise.all([
    prisma.client.findMany({
      where: { kitchenId: kitchen.id, active: true },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    }),
    prisma.cookDate.findMany({
      where: { kitchenId: kitchen.id },
      include: {
        client: true,
        finalizedProposal: true,
      },
      orderBy: {
        scheduledFor: "asc",
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cook Dates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Schedule service visits and attach proposals to each date.
        </p>
      </div>

      <CookDatesView
        cookDates={cookDates.map((cd) => ({
          id: cd.id,
          scheduledFor: cd.scheduledFor.toISOString(),
          startTimeLabel: cd.startTimeLabel,
          guestCount: cd.guestCount,
          status: cd.status,
          serviceNotes: cd.serviceNotes,
          clientName: `${cd.client.firstName} ${cd.client.lastName}`,
          proposalTitle: cd.finalizedProposal?.title ?? null,
        }))}
        clients={clients.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
        }))}
        preselectedClientId={preselectedClientId}
      />

    </div>
  );
}
