"use client";

import { useState } from "react";
import { updateInvoice } from "@/app/actions";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface LineItem {
  description: string;
  amount: string;
}

interface InitialInvoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  invoiceDate: string;
  remarks: string | null;
  lineItems: { description: string; amount: number }[];
}

export function InvoiceEditForm({
  invoice,
  clients,
}: {
  invoice: InitialInvoice;
  clients: ClientOption[];
}) {
  const [clientId, setClientId] = useState(invoice.clientId);
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoiceDate);
  const [lines, setLines] = useState<LineItem[]>(
    invoice.lineItems.length > 0
      ? invoice.lineItems.map((li) => ({
          description: li.description,
          amount: li.amount.toString(),
        }))
      : [{ description: "", amount: "" }],
  );
  const [remarksText, setRemarksText] = useState(invoice.remarks ?? "");

  function addLine() {
    setLines([...lines, { description: "", amount: "" }]);
  }

  function removeLine(index: number) {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LineItem, value: string) {
    const cleaned = field === "amount" ? value.replace(/[^0-9.\-]/g, "") : value;
    setLines(
      lines.map((item, i) => (i === index ? { ...item, [field]: cleaned } : item)),
    );
  }

  const total = lines.reduce((sum, item) => {
    const amt = parseFloat(item.amount.replace(/[^0-9.\-]/g, ""));
    return sum + (Number.isFinite(amt) ? amt : 0);
  }, 0);

  return (
    <div className="panel p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          Edit invoice #{invoice.invoiceNumber}
        </h2>
      </div>

      <form action={updateInvoice}>
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Client
            </label>
            <select
              className="field"
              name="clientId"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select a client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.firstName} {client.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Invoice date
            </label>
            <input
              className="field"
              name="invoiceDate"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-700">
                Line items
              </label>
              <button
                type="button"
                onClick={addLine}
                className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                + Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <input
                    className="field flex-1"
                    name="lineDescription"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) =>
                      updateLine(index, "description", e.target.value)
                    }
                    required
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      $
                    </span>
                    <input
                      className="field w-40 pl-7"
                      name="lineAmount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={item.amount}
                      onChange={(e) =>
                        updateLine(index, "amount", e.target.value)
                      }
                      required
                    />
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="mt-2.5 text-slate-400 hover:text-red-500"
                      title="Remove line"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {lines.some((l) => l.amount) && (
              <div className="mt-3 flex justify-end">
                <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                  Total:{" "}
                  <span className="text-[#60a5fa]">
                    {total < 0
                      ? `-$${Math.abs(total).toFixed(2)}`
                      : `$${total.toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Remarks{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              className="field min-h-20"
              name="remarks"
              placeholder="Custom payment instructions or notes"
              value={remarksText}
              onChange={(e) => setRemarksText(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <a
            href={`/invoices/${invoice.id}`}
            className="button-secondary text-sm"
          >
            Cancel
          </a>
          <button className="button-primary text-sm" type="submit">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
