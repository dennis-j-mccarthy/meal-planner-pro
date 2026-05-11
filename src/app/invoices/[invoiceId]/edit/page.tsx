import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getKitchen } from "@/lib/data";
import { InvoiceEditForm } from "@/components/invoice-edit-form";

export default async function InvoiceEditPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const kitchen = await getKitchen();

  const [invoice, clients] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id: invoiceId, kitchenId: kitchen.id },
      include: {
        lineItems: { orderBy: { position: "asc" } },
      },
    }),
    prisma.client.findMany({
      where: { kitchenId: kitchen.id, active: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  if (!invoice) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/invoices" className="hover:text-slate-900">
          Invoices
        </Link>
        <span>/</span>
        <Link
          href={`/invoices/${invoice.id}`}
          className="hover:text-slate-900"
        >
          #{invoice.invoiceNumber}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Edit</span>
      </div>

      <InvoiceEditForm
        invoice={{
          id: invoice.id,
          clientId: invoice.clientId,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          remarks: invoice.remarks,
          lineItems: invoice.lineItems.map((li) => ({
            description: li.description,
            amount: li.amount,
          })),
        }}
        clients={clients}
      />
    </div>
  );
}
