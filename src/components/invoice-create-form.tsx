"use client";

import { useState, useRef } from "react";
import { createInvoice } from "@/app/actions";

interface ClientOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface LineItem {
  description: string;
  amount: string;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function parseQuickInput(
  input: string,
  clients: ClientOption[],
): { clientId: string; date: string; lines: LineItem[]; remarks: string } | null {
  // Extract dollar amounts
  const amountMatches = [...input.matchAll(/\$[\d,]+(?:\.\d{2})?/g)];
  const amounts = amountMatches.map((m) => m[0].replace(/[$,]/g, ""));
  if (amounts.length === 0) return null;

  // Extract parenthetical remarks
  const remarksMatch = input.match(/\(([^)]+)\)/);
  const remarks = remarksMatch ? remarksMatch[1] : "";

  // Clean input for parsing
  let cleaned = input;
  for (const m of amountMatches) cleaned = cleaned.replace(m[0], " ");
  if (remarksMatch) cleaned = cleaned.replace(remarksMatch[0], " ");

  const parts = cleaned
    .split(/[,\-]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  // Match client
  let clientId = "";
  let clientPartIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    const lower = parts[i].toLowerCase();
    const match = clients.find(
      (c) =>
        c.lastName.toLowerCase() === lower ||
        c.lastName.toLowerCase().startsWith(lower) ||
        lower.includes(c.lastName.toLowerCase()),
    );
    if (match) {
      clientId = match.id;
      clientPartIdx = i;
      break;
    }
  }

  // Parse date
  let date = new Date().toISOString().slice(0, 10);
  let datePartIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    const words = parts[i].toLowerCase().trim().split(/\s+/);
    if (words.length >= 2 && MONTH_MAP[words[0]] !== undefined) {
      const day = parseInt(words[1], 10);
      if (day >= 1 && day <= 31) {
        const year = words[2] ? parseInt(words[2], 10) : new Date().getFullYear();
        const d = new Date(year, MONTH_MAP[words[0]], day);
        date = d.toISOString().slice(0, 10);
        datePartIdx = i;
        break;
      }
    }
  }

  // Remaining parts are descriptions
  const descParts = parts.filter((_, i) => i !== clientPartIdx && i !== datePartIdx);
  const description = descParts.length > 0 ? descParts.join(", ") : "Services";

  const lines: LineItem[] = amounts.map((amt) => ({
    description,
    amount: amt,
  }));

  return { clientId, date, lines, remarks };
}

export function InvoiceCreateForm({
  clients,
  nextNumber,
  preselectedClientId = "",
}: {
  clients: ClientOption[];
  nextNumber: string;
  preselectedClientId?: string;
}) {
  const [quickInput, setQuickInput] = useState("");
  const [clientId, setClientId] = useState(preselectedClientId);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", amount: "" },
  ]);
  const [remarksText, setRemarksText] = useState("");
  const [quickFeedback, setQuickFeedback] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleQuickParse() {
    const result = parseQuickInput(quickInput, clients);
    if (!result) {
      setQuickFeedback("Could not parse. Include at least a $amount.");
      return;
    }

    if (result.clientId) setClientId(result.clientId);
    setInvoiceDate(result.date);
    setLines(result.lines);
    if (result.remarks) setRemarksText(result.remarks);

    const matchedClient = clients.find((c) => c.id === result.clientId);
    setQuickFeedback(
      matchedClient
        ? `Filled: ${matchedClient.firstName} ${matchedClient.lastName}, ${result.date}, ${result.lines.length} line(s)`
        : `Parsed ${result.lines.length} line(s) — please select a client.`,
    );
  }

  function handleQuickKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleQuickParse();
    }
  }

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
        <h2 className="text-lg font-bold text-slate-900">New invoice</h2>
        <p className="mt-1 text-sm text-slate-500">
          Next: <strong>{nextNumber}</strong>
        </p>
      </div>

      {/* Quick create */}
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
          Quick create
        </label>
        <p className="text-xs text-slate-500 mb-2">
          e.g. &quot;Personal Chef Service, Schwartz, Apr 7, $1160&quot;
        </p>
        <div className="flex gap-2">
          <input
            className="field flex-1 text-sm"
            value={quickInput}
            onChange={(e) => {
              setQuickInput(e.target.value);
              setQuickFeedback("");
            }}
            onKeyDown={handleQuickKeyDown}
            placeholder="Description, client, date, $amount..."
          />
          <button
            type="button"
            onClick={handleQuickParse}
            disabled={!quickInput.trim()}
            className="button-primary text-sm shrink-0 disabled:opacity-50"
          >
            Fill
          </button>
        </div>
        {quickFeedback && (
          <p className="mt-2 text-xs font-medium text-[var(--accent)]">
            {quickFeedback}
          </p>
        )}
      </div>

      {/* Full form */}
      <form ref={formRef} action={createInvoice}>
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

          {/* Line items */}
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
                    placeholder="Description (e.g. Groceries, Personal Chef Services)"
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
            {total > 0 && (
              <div className="mt-3 flex justify-end">
                <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                  Total:{" "}
                  <span className="text-[#60a5fa]">${total.toFixed(2)}</span>
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
              placeholder="Custom payment instructions or notes (defaults to standard Zelle/check info)"
              value={remarksText}
              onChange={(e) => setRemarksText(e.target.value)}
            />
          </div>
        </div>

        <button className="button-primary mt-5 w-full" type="submit">
          Create invoice
        </button>
      </form>
    </div>
  );
}
