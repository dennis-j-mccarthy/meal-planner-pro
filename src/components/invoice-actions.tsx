"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateInvoiceStatus, deleteInvoice, sendInvoiceEmail } from "@/app/actions";

interface InvoiceActionsProps {
  invoiceId: string;
  status: string;
}

export function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
  const router = useRouter();

  async function handleDownload() {
    const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    const fd = new FormData();
    fd.set("invoiceId", invoiceId);
    await deleteInvoice(fd);
    router.push("/invoices");
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Edit */}
      <Link
        href={`/invoices/${invoiceId}/edit`}
        className="button-secondary text-sm"
      >
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
        </svg>
        Edit
      </Link>

      {/* PDF actions */}
      <a
        href={`/api/invoices/${invoiceId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="button-primary text-sm"
      >
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        Preview PDF
      </a>
      <button onClick={handleDownload} className="button-secondary text-sm">
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Download PDF
      </button>
      <a
        href={`/api/invoices/${invoiceId}/eml`}
        className="button-secondary text-sm"
      >
        <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
        </svg>
        Download Email
      </a>

      {/* Send email */}
      <form action={sendInvoiceEmail}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <button className="button-secondary text-sm border-blue-200 text-blue-700 hover:bg-blue-50">
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
          Send to Beth
        </button>
      </form>

      {/* Status transitions */}
      {status === "DRAFT" && (
        <form action={updateInvoiceStatus}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="status" value="SENT" />
          <button className="button-secondary text-sm border-slate-200 text-slate-600 hover:bg-slate-50">
            Mark as sent
          </button>
        </form>
      )}
      {(status === "DRAFT" || status === "SENT") && (
        <form action={updateInvoiceStatus}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="status" value="PAID" />
          <button className="button-secondary text-sm border-green-200 text-green-700 hover:bg-green-50">
            Mark as paid
          </button>
        </form>
      )}
      {status !== "VOID" && (
        <form action={updateInvoiceStatus}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="status" value="VOID" />
          <button className="button-secondary text-sm border-red-200 text-red-600 hover:bg-red-50">
            Void
          </button>
        </form>
      )}

      {/* Delete */}
      {status === "DRAFT" && (
        <button
          onClick={handleDelete}
          className="button-secondary text-sm border-red-200 text-red-600 hover:bg-red-50 ml-auto"
        >
          Delete
        </button>
      )}
    </div>
  );
}
