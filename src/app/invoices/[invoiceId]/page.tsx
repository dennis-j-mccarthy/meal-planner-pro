import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateShort } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { InvoiceActions } from "@/components/invoice-actions";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      lineItems: { orderBy: { position: "asc" } },
    },
  });

  if (!invoice) notFound();

  const total = invoice.lineItems.reduce((sum, li) => sum + li.amount, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/invoices" className="hover:text-slate-900">
          Invoices
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">#{invoice.invoiceNumber}</span>
      </div>

      {/* Header */}
      <div className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                Invoice #{invoice.invoiceNumber}
              </h1>
              <StatusBadge label={invoice.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {invoice.client.firstName} {invoice.client.lastName}
              {invoice.client.address && (
                <span className="ml-2 text-slate-400">
                  &middot; {invoice.client.address.split("\n")[0]}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatDateShort(invoice.invoiceDate)}
              {invoice.sentAt && (
                <span className="ml-2 text-slate-400">
                  &middot; Sent {formatDateShort(invoice.sentAt)}
                </span>
              )}
              {invoice.paidAt && (
                <span className="ml-2 text-slate-400">
                  &middot; Paid {formatDateShort(invoice.paidAt)}
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">${total.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
        </div>
      </div>

      {/* Line items */}
      <div className="panel p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Line items</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Description</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600 w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((li) => (
                <tr key={li.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-900">{li.description}</td>
                  <td className="px-4 py-3 text-right text-slate-900">${li.amount.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-900">Total</td>
                <td className="px-4 py-3 text-right font-bold text-[#60a5fa] text-base">
                  ${total.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Remarks */}
      {invoice.remarks && (
        <div className="panel p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Remarks</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{invoice.remarks}</p>
        </div>
      )}
    </div>
  );
}
