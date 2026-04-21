import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { InvoiceCreateForm } from "@/components/invoice-create-form";
import { formatDateShort } from "@/lib/format";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { getNextInvoiceNumber } from "@/lib/invoice-number";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const kitchen = await getKitchen();
  const params = await searchParams;
  const preselectedClientId = params.clientId || "";
  const nextNumber = await getNextInvoiceNumber();

  const [clients, invoices] = await Promise.all([
    prisma.client.findMany({
      where: { kitchenId: kitchen.id, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.invoice.findMany({
      where: { kitchenId: kitchen.id },
      include: {
        client: true,
        lineItems: { orderBy: { position: "asc" } },
      },
      orderBy: { invoiceDate: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create and manage client invoices.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <InvoiceCreateForm clients={clients} nextNumber={nextNumber} preselectedClientId={preselectedClientId} />

        {/* Invoice list */}
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-900">All invoices</h2>
            <span className="text-sm text-slate-500">{invoices.length} total</span>
          </div>

          <div className="mt-5 space-y-3">
            {invoices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
                No invoices yet. Create your first one using the form.
              </div>
            ) : (
              invoices.map((invoice) => {
                const total = invoice.lineItems.reduce(
                  (sum, li) => sum + li.amount,
                  0,
                );

                return (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="block rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            #{invoice.invoiceNumber}
                          </h3>
                          <StatusBadge label={invoice.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {invoice.client.firstName} {invoice.client.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDateShort(invoice.invoiceDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">
                          ${total.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {invoice.lineItems.length} item{invoice.lineItems.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
