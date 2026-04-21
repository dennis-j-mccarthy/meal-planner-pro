import Link from "next/link";
import { notFound } from "next/navigation";
import { createCookDate } from "@/app/actions";
import { StatusBadge } from "@/components/status-badge";
import { formatDateShort, formatDateLong, formatEnum } from "@/lib/format";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const kitchen = await getKitchen();

  const client = await prisma.client.findFirst({
    where: { id: clientId, kitchenId: kitchen.id },
    include: {
      cookDates: {
        include: {
          finalizedProposal: true,
          proposals: { select: { id: true, status: true } },
          menuCards: { select: { id: true, title: true } },
        },
        orderBy: { scheduledFor: "desc" },
      },
      invoices: {
        include: {
          lineItems: { orderBy: { position: "asc" } },
        },
        orderBy: { invoiceDate: "desc" },
      },
      menuCards: {
        where: { cookDateId: null },
        include: {
          recipes: {
            include: { recipe: { select: { title: true } } },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { menuDate: "desc" },
      },
    },
  });

  if (!client) notFound();

  const now = new Date();
  const upcomingCookDates = client.cookDates.filter(
    (cd) => cd.scheduledFor >= now,
  );
  const pastCookDates = client.cookDates.filter(
    (cd) => cd.scheduledFor < now,
  );

  // Invoices not linked to cook dates
  const standaloneInvoices = client.invoices;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/clients" className="hover:text-slate-900">
          Clients
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">
          {client.firstName} {client.lastName}
        </span>
      </div>

      {/* Client header */}
      <div className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {client.firstName} {client.lastName}
            </h1>
            {client.householdLabel && (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {client.householdLabel}
              </p>
            )}
            <div className="mt-2 space-y-0.5 text-sm text-slate-500">
              {client.email && <p>{client.email}</p>}
              {client.phone && <p>{client.phone}</p>}
              {client.address && (
                <p className="whitespace-pre-line">{client.address}</p>
              )}
            </div>
            {client.dietaryNotes && (
              <p className="mt-3 text-sm text-slate-600">
                {client.dietaryNotes}
              </p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <StatusBadge label={client.active ? "Active" : "Inactive"} />
            <div className="text-right text-xs text-slate-500">
              <p>{client.cookDates.length} cook date{client.cookDates.length !== 1 ? "s" : ""}</p>
              <p>{client.invoices.length} invoice{client.invoices.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/cook-dates?clientId=${client.id}`}
          className="button-primary text-sm"
        >
          + New cook date
        </Link>
        <Link
          href={`/invoices?clientId=${client.id}`}
          className="button-secondary text-sm"
        >
          + New invoice
        </Link>
        <Link
          href={`/menu-cards?clientId=${client.id}`}
          className="button-secondary text-sm"
        >
          + New Bon Appetit
        </Link>
      </div>

      {/* Upcoming cook dates */}
      {upcomingCookDates.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Upcoming cook dates
          </h2>
          <div className="space-y-3">
            {upcomingCookDates.map((cd) => (
              <Link
                key={cd.id}
                href={`/cook-dates/${cd.id}`}
                className="block panel p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {formatDateLong(cd.scheduledFor)}
                      </p>
                      <StatusBadge label={formatEnum(cd.status)} />
                    </div>
                    {cd.startTimeLabel && (
                      <p className="mt-0.5 text-sm text-slate-500">
                        {cd.startTimeLabel}
                      </p>
                    )}
                    {cd.serviceNotes && (
                      <p className="mt-1 text-sm text-slate-600">
                        {cd.serviceNotes}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>
                      {cd.proposals.length} proposal{cd.proposals.length !== 1 ? "s" : ""}
                    </p>
                    {cd.menuCards.length > 0 && (
                      <p>{cd.menuCards.length} Bon Appetit</p>
                    )}
                    {cd.finalizedProposal && (
                      <p className="font-medium text-[var(--accent)]">
                        Menu approved
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Past cook dates */}
      {pastCookDates.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Past cook dates
          </h2>
          <div className="space-y-2">
            {pastCookDates.map((cd) => (
              <Link
                key={cd.id}
                href={`/cook-dates/${cd.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-slate-700">
                    {formatDateShort(cd.scheduledFor)}
                  </p>
                  <StatusBadge label={formatEnum(cd.status)} />
                </div>
                <p className="text-xs text-slate-500">
                  {cd.finalizedProposal?.title || `${cd.proposals.length} proposals`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Invoices */}
      {standaloneInvoices.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Invoices</h2>
          <div className="space-y-2">
            {standaloneInvoices.map((inv) => {
              const total = inv.lineItems.reduce(
                (sum, li) => sum + li.amount,
                0,
              );
              return (
                <Link
                  key={inv.id}
                  href={`/invoices/${inv.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      #{inv.invoiceNumber}
                    </p>
                    <StatusBadge label={inv.status} />
                    <p className="text-xs text-slate-500">
                      {formatDateShort(inv.invoiceDate)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    ${total.toFixed(2)}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Ad-hoc Bon Appetits (no cook date) */}
      {client.menuCards.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Ad-hoc Bon Appetits
          </h2>
          <div className="space-y-2">
            {client.menuCards.map((mc) => (
              <Link
                key={mc.id}
                href={`/menu-cards/${mc.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {mc.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateShort(mc.menuDate)} &middot;{" "}
                    {mc.recipes.length} recipes
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {client.cookDates.length === 0 &&
        client.invoices.length === 0 &&
        client.menuCards.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            No cook dates, invoices, or Bon Appetits yet. Use the buttons above
            to get started.
          </div>
        )}
    </div>
  );
}
