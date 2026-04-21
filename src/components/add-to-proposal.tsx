"use client";

import { useRef, useState, useTransition } from "react";
import { addRecipeToProposal } from "@/app/actions";
import Link from "next/link";

type Proposal = {
  id: string;
  title: string;
  status: string;
  clientName: string;
  cookDateLabel: string;
  recipeIds: string[];
};

type AddToProposalProps = {
  recipeId: string;
  proposals: Proposal[];
  size?: "sm" | "md";
};

export function AddToProposal({ recipeId, proposals, size = "md" }: AddToProposalProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const editable = proposals.filter(
    (p) => p.status === "DRAFT" || p.status === "REVISIONS_REQUESTED",
  );

  function handleAdd(proposalId: string) {
    setError(null);
    const formData = new FormData();
    formData.set("proposalId", proposalId);
    formData.set("recipeId", recipeId);

    startTransition(async () => {
      try {
        await addRecipeToProposal(formData);
        setAddedTo((prev) => new Set(prev).add(proposalId));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to add");
      }
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
          setError(null);
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] shadow-sm ${
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"
        }`}
      >
        <svg className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Proposal
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1.5 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-sm font-bold text-slate-900">
              Add to proposal
            </p>
            {error && (
              <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
            )}
            {editable.length === 0 ? (
              <div className="mt-3">
                <p className="text-sm text-slate-500">
                  No draft proposals available. Create one first.
                </p>
                <Link
                  href="/proposals"
                  onClick={() => setOpen(false)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-strong)]"
                >
                  Go to proposals
                </Link>
              </div>
            ) : (
              <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
                {editable.map((proposal) => {
                  const alreadyOn =
                    proposal.recipeIds.includes(recipeId) || addedTo.has(proposal.id);

                  return (
                    <button
                      key={proposal.id}
                      type="button"
                      disabled={alreadyOn || isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAdd(proposal.id);
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                        alreadyOn
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 hover:border-[var(--accent)] hover:bg-[var(--accent-light)] text-slate-700 disabled:opacity-50"
                      }`}
                    >
                      <span className="block font-medium">{proposal.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {proposal.clientName} · {proposal.cookDateLabel}
                      </span>
                      {alreadyOn && (
                        <span className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          Added
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
