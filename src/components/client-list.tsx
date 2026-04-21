"use client";

import { useState } from "react";
import Link from "next/link";
import { approveProposal, requestProposalRevision, sendBonAppetitEmail } from "@/app/actions";
import { QuickCookDate } from "@/components/quick-cook-date";

interface ProposalSummary {
  id: string;
  title: string;
  status: string;
}

interface BonAppetitSummary {
  id: string;
  title: string;
  accepted: boolean;
}

interface CookDateSummary {
  id: string;
  scheduledFor: string;
  status: string;
  startTimeLabel: string | null;
  hasApprovedMenu: boolean;
  approvedMenuTitle: string | null;
  proposals: ProposalSummary[];
  bonAppetits: BonAppetitSummary[];
}

interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: string;
  total: number;
}

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  householdLabel: string | null;
  dietaryNotes: string | null;
  address: string | null;
  active: boolean;
  nextCookDate: string | null;
  cookDateCount: number;
  invoiceCount: number;
  cookDates: CookDateSummary[];
  invoices: InvoiceSummary[];
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatus(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function statusPill(status: string) {
  const s = status.toUpperCase();
  if (s === "APPROVED" || s === "COMPLETED" || s === "PAID")
    return "bg-green-50 text-green-700";
  if (s === "PROPOSED" || s === "SENT") return "bg-blue-50 text-blue-700";
  if (s === "CANCELLED" || s === "VOID") return "bg-red-50 text-red-600";
  if (s === "REVISIONS_REQUESTED") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-500";
}

// ── Shared nested content for both views ──
function ClientNestedContent({ client }: { client: ClientData }) {
  const [openCdId, setOpenCdId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {/* Client info */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
        {client.email && <p>{client.email}</p>}
        {client.phone && <p>{client.phone}</p>}
        {client.address && (
          <p className="whitespace-pre-line">{client.address}</p>
        )}
      </div>
      {client.dietaryNotes && (
        <p className="text-sm text-slate-500 italic">{client.dietaryNotes}</p>
      )}

      {/* Cook dates with nested children */}
      {client.cookDates.length > 0 && (
        <div>
          <div className="space-y-3">
            {client.cookDates.map((cd) => (
              <div
                key={cd.id}
                className="rounded-lg border border-slate-200 overflow-hidden"
              >
                {/* Cook date header — accordion toggle */}
                <div
                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${openCdId === cd.id ? "bg-slate-50" : "hover:bg-slate-50"}`}
                >
                  <div
                    className="flex items-center gap-2 flex-1"
                    onClick={() => setOpenCdId(openCdId === cd.id ? null : cd.id)}
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {formatShort(cd.scheduledFor)}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusPill(cd.status)}`}
                    >
                      {formatStatus(cd.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {cd.hasApprovedMenu && (
                      <span className="text-xs font-medium text-green-600">
                        ✓ Menu approved
                      </span>
                    )}
                    <button
                      type="button"
                      className="rounded p-1 text-slate-300 hover:text-red-500 hover:bg-red-50"
                      title="Delete cook date"
                      onClick={async () => {
                        if (!confirm("Delete this cook date and all its proposals and bon appetits?")) return;
                        const res = await fetch("/api/cook-dates/delete", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ cookDateId: cd.id }),
                        });
                        if (res.ok) window.location.reload();
                        else alert("Failed to delete");
                      }}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <svg
                      className={`h-4 w-4 text-slate-400 transition-transform ${openCdId === cd.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                      onClick={() => setOpenCdId(openCdId === cd.id ? null : cd.id)}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {/* Nested: proposals, bon appetits — only when open */}
                {openCdId === cd.id && (cd.proposals.length > 0 || cd.bonAppetits.length > 0) && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 space-y-1">
                    {cd.proposals.map((p) => (
                      <div key={p.id} className="rounded px-2 py-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/proposals/${p.id}`}
                            className="flex items-center gap-2 hover:bg-white transition-colors flex-1 min-w-0"
                          >
                            <svg
                              className="h-3.5 w-3.5 text-slate-400 shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                              />
                            </svg>
                            <span className="text-slate-700 font-medium truncate">
                              {p.title}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${statusPill(p.status)}`}
                            >
                              {formatStatus(p.status)}
                            </span>
                          </Link>
                          {(p.status === "SENT" || p.status === "DRAFT" || p.status === "REVISIONS_REQUESTED") && (
                            <div className="flex gap-1 shrink-0">
                              <form action={approveProposal}>
                                <input type="hidden" name="proposalId" value={p.id} />
                                <button className="rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-100 transition-colors">
                                  Approved
                                </button>
                              </form>
                              <form action={requestProposalRevision}>
                                <input type="hidden" name="proposalId" value={p.id} />
                                <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                  Changes
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {cd.bonAppetits.map((ba) => (
                      <div key={ba.id} className="rounded bg-white px-2 py-2 text-xs">
                        <div className="flex items-center gap-2 mb-1.5">
                          <svg
                            className="h-3.5 w-3.5 text-green-500 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6V7.5Z"
                            />
                          </svg>
                          <span className="text-slate-700 font-medium">
                            {ba.title}
                          </span>
                          <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                            Ready
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 ml-5">
                          <a
                            href={`/api/menu-cards/${ba.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            Preview PDF
                          </a>
                          <a
                            href={`/api/menu-cards/${ba.id}/eml`}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            Download Email
                          </a>
                          <form action={sendBonAppetitEmail}>
                            <input type="hidden" name="menuCardId" value={ba.id} />
                            <button className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors">
                              Send to Beth
                            </button>
                          </form>
                          <button
                            type="button"
                            className="rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete"
                            onClick={async () => {
                              if (!confirm("Delete this Bon Appetit?")) return;
                              const res = await fetch("/api/menu-cards/delete", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ menuCardId: ba.id }),
                              });
                              if (res.ok) window.location.reload();
                              else alert("Failed to delete");
                            }}
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices */}
      {client.invoices.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Invoices
          </h4>
          <div className="space-y-1">
            {client.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-slate-50 transition-colors">
                <Link
                  href={`/invoices/${inv.id}`}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <span className="font-medium text-slate-700">
                    #{inv.invoiceNumber}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatShort(inv.invoiceDate)}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusPill(inv.status)}`}
                  >
                    {formatStatus(inv.status)}
                  </span>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-slate-900">
                    ${inv.total.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50"
                    title="Delete"
                    onClick={async () => {
                      if (!confirm("Delete this invoice?")) return;
                      const res = await fetch("/api/invoices/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ invoiceId: inv.id }),
                      });
                      if (res.ok) window.location.reload();
                      else alert("Failed to delete");
                    }}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Main export ──
export function ClientList({ clients }: { clients: ClientData[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">
          Client roster
          <span className="ml-2 text-sm font-normal text-slate-500">
            {clients.length} total
          </span>
        </h2>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
          No clients yet. Add the first household using the button above.
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => {
            const isOpen = openId === client.id;
            return (
              <div
                key={client.id}
                className={`rounded-xl border overflow-hidden transition-all ${
                  isOpen
                    ? "border-[var(--accent)] shadow-lg ring-2 ring-[var(--accent)]/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Accordion header */}
                <div
                  className={`flex items-center gap-3 px-5 py-4 transition-colors ${
                    isOpen ? "bg-[var(--accent-light)]" : "hover:bg-slate-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : client.id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                      {client.firstName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900 truncate">
                        {client.firstName} {client.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {client.cookDateCount} cook dates ·{" "}
                        {client.invoiceCount} invoices
                        {client.nextCookDate &&
                          ` · Next: ${formatShort(client.nextCookDate)}`}
                      </p>
                    </div>
                  </button>

                  {/* Action buttons — text + icon */}
                  <div className="flex items-center gap-2 shrink-0">
                    <QuickCookDate clientId={client.id} />
                    <Link
                      href={`/invoices?clientId=${client.id}`}
                      className="button-secondary text-xs px-3 py-1.5"
                    >
                      + Invoice
                    </Link>
                  </div>

                  {/* +/- toggle — large and distinct */}
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : client.id)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold shrink-0 transition-colors ${
                      isOpen
                        ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                    title={isOpen ? "Collapse" : "Expand"}
                  >
                    {isOpen ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-[var(--accent)]/30 bg-white px-5 py-5">
                    <ClientNestedContent client={client} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
