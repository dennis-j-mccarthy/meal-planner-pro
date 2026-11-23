import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireKitchen } from "@/lib/guard";
import { formatDateShort, formatMoney } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { InvoiceActions } from "@/components/invoice-actions";
import { formatMonthKey, formatWeekdayLong } from "@/lib/dates";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const kitchen = await requireKitchen();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, kitchenId: kitchen.id },
    include: {
      client: true,
      lineItems: { orderBy: { position: "asc" } },
    },
  });

  if (!invoice) notFound();

  // Invoice.cookDateId has no relation: look the cook date up in this kitchen.
  // It may have been deleted since.
  const cookDate = invoice.cookDateId
    ? await prisma.cookDate.findFirst({
        where: { id: invoice.cookDateId, kitchenId: kitchen.id },
        select: { id: true, scheduledFor: true },
      })
    : null;

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
              <h1 className="page-title">
                Invoice #{invoice.invoiceNumber}
              </h1>
              <StatusBadge status={invoice.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {invoice.client.firstName} {invoice.client.lastName}
              {invoice.client.address && (
                <span className="ml-2 text-slate-400">
                  &middot; {invoice.client.address.split("\n")[0]}
                </span>
              )}
            </p>
            {cookDate ? (
              <p className="mt-0.5 text-sm text-slate-500">
                Cook date:{" "}
                <Link
                  href={`/cook-dates/${cookDate.id}`}
                  className="font-medium text-[var(--accent-strong)] hover:underline"
                >
                  {formatWeekdayLong(cookDate.scheduledFor)}
                </Link>
              </p>
            ) : invoice.billingPeriod ? (
              <p className="mt-0.5 text-sm text-slate-500">
                Monthly · {formatMonthKey(invoice.billingPeriod)}
              </p>
            ) : null}
            <p className="mt-0.5 text-sm text-slate-500">
              {formatDateShort(invoice.invoiceDate)}
              {invoice.sentAt && (
                <span className="ml-2 text-slate-400">
                  &middot; Sent {formatDateShort(invoice.sentAt)}
                </span>
              )}
              {invoice.paidAt && (
                <span className="ml-2 text-slate-400">
                  &middot;{" "}
                  {invoice.paidMethod
                    ? `Paid by ${invoice.paidMethod} on ${formatDateShort(invoice.paidAt)}`
                    : `Paid ${formatDateShort(invoice.paidAt)}`}
                  {invoice.paidNote && ` (${invoice.paidNote})`}
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-900">{formatMoney(total)}</p>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            clientEmail={invoice.client.email}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="panel p-6">
        <h2 className="section-title mb-4">Line items</h2>
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
                  <td className="px-4 py-3 text-right text-slate-900">{formatMoney(li.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="px-4 py-3 font-bold text-slate-900">Total</td>
                <td className="px-4 py-3 text-right font-bold text-[#60a5fa] text-base">
                  {formatMoney(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Remarks */}
      {invoice.remarks && (
        <div className="panel p-6">
          <h2 className="section-title mb-2">Remarks</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{invoice.remarks}</p>
        </div>
      )}
    </div>
  );
}
