"use client";

import { useState } from "react";
import Image from "next/image";
import { submitProposalReview } from "@/app/actions";

type ReviewRecipe = {
  id: string;
  title: string;
  description: string | null;
  cuisine: string | null;
  imageUrl: string | null;
  courseLabel: string | null;
};

export function ProposalReviewForm({
  token,
  recipes,
}: {
  token: string;
  recipes: ReviewRecipe[];
}) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "changes">(null);
  const [done, setDone] = useState<null | "approve" | "changes">(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(decision: "approve" | "changes") {
    setError(null);
    setBusy(decision);
    try {
      const fd = new FormData();
      fd.set("token", token);
      fd.set("decision", decision);
      fd.set("comment", comment);
      for (const id of removed) fd.append("removed", id);
      await submitProposalReview(fd);
      setDone(decision);
    } catch {
      setError("Something went wrong submitting your notes. Please try again.");
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-lg font-bold text-emerald-800">
          {done === "approve" ? "Approved — thank you!" : "Got it — thank you!"}
        </h2>
        <p className="mt-2 text-sm text-emerald-700">
          {done === "approve"
            ? "Your chef has been notified that you approved this plan."
            : "Your chef has been notified and will follow up with an updated plan."}
        </p>
      </div>
    );
  }

  const keptCount = recipes.length - removed.size;

  return (
    <div className="mt-4 space-y-3">
      {recipes.map((r) => {
        const isRemoved = removed.has(r.id);
        return (
          <div
            key={r.id}
            className={`flex gap-3 rounded-2xl border bg-white p-4 shadow-sm transition ${
              isRemoved ? "border-slate-200 opacity-60" : "border-slate-200"
            }`}
          >
            {r.imageUrl && (
              <Image
                src={r.imageUrl}
                alt={r.title}
                width={72}
                height={72}
                className="h-18 w-18 shrink-0 rounded-xl object-cover"
                style={{ height: 72, width: 72 }}
              />
            )}
            <div className="min-w-0 flex-1">
              {r.courseLabel && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {r.courseLabel}
                </p>
              )}
              <h3
                className={`font-semibold text-slate-900 ${
                  isRemoved ? "line-through" : ""
                }`}
              >
                {r.title}
              </h3>
              {r.description && (
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                  {r.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggle(r.id)}
              className={`shrink-0 self-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                isRemoved
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              }`}
            >
              {isRemoved ? "Add back" : "Remove"}
            </button>
          </div>
        );
      })}

      <p className="px-1 text-xs text-slate-400">
        Keeping {keptCount} of {recipes.length} dishes.
      </p>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything you'd like your chef to know? (allergies, swaps, portion sizes, dates...)"
        className="min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[var(--accent,#f59e0b)] focus:ring-2 focus:ring-amber-200"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => submit("approve")}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy === "approve" ? "Submitting..." : "Approve this plan"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => submit("changes")}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "changes" ? "Submitting..." : "Request changes"}
        </button>
      </div>
    </div>
  );
}
