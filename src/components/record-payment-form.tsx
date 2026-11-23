"use client";

import { HandCoins } from "lucide-react";
import { useRouter } from "next/navigation";
import { recordInvoicePayment } from "@/app/actions";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

// "Record payment": how it was paid, plus an optional note (check #). Used on
// the invoice page and on the cook date page.
export function RecordPaymentForm({
  invoiceId,
  primary = false,
}: {
  invoiceId: string;
  /** Use the main button style (the cook date page's one next step). */
  primary?: boolean;
}) {
  const router = useRouter();
  return (
    <form
      action={async (formData) => {
        await recordInvoicePayment(formData);
        router.refresh();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <label className="text-sm text-slate-600" htmlFor={`method-${invoiceId}`}>
        Paid by
      </label>
      <select
        id={`method-${invoiceId}`}
        name="method"
        defaultValue="Zelle"
        className="field w-auto!"
      >
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <input
        name="note"
        aria-label="Note"
        placeholder="Note, e.g. check # (optional)"
        className="field w-56! max-w-full"
      />
      <button
        className={
          primary
            ? "button-primary text-sm"
            : "button-secondary text-sm border-green-200 text-green-700 hover:bg-green-50"
        }
      >
        <HandCoins aria-hidden="true" />
        Record payment
      </button>
    </form>
  );
}
