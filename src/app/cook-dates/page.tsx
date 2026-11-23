import Link from "next/link";
import { CookDatesView } from "@/components/cook-dates-view";
import { StatusBadge } from "@/components/status-badge";
import { formatWeekdayShort, todayStart } from "@/lib/dates";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

export default async function CookDatesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const kitchen = await requireKitchen();
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

  const start = todayStart();
  const upcoming = cookDates
    .filter((cd) => cd.scheduledFor >= start && cd.status !== "CANCELLED")
    .slice(0, 20);

  return (
    <div className="space-y-10 fade-up">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="mt-2 text-sm muted">
            Every cook date. Click a day to add one.
          </p>
        </div>
        <Link href="#new-cook-date" className="button-primary">
          + New cook date
        </Link>
      </header>

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
      >
        <section aria-labelledby="upcoming">
          <h2 id="upcoming" className="section-title">
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <p className="panel mt-4 px-5 py-8 text-center text-sm muted">
              No upcoming cook dates.
            </p>
          ) : (
            <ul className="panel mt-4 divide-y divide-[var(--line)]">
              {upcoming.map((cd) => (
                <li key={cd.id}>
                  <Link
                    href={`/cook-dates/${cd.id}`}
                    className="flex min-h-14 items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--surface-raised)]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {formatWeekdayShort(cd.scheduledFor)}
                        <span className="font-normal muted">
                          {cd.startTimeLabel ? ` · ${cd.startTimeLabel}` : ""}
                        </span>
                      </p>
                      <p className="mt-1 truncate text-sm muted">
                        {cd.client.firstName} {cd.client.lastName}
                      </p>
                    </div>
                    <StatusBadge status={cd.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CookDatesView>
    </div>
  );
}
