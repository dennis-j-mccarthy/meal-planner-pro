"use client";

import { useState } from "react";
import Image from "next/image";
import { submitProposalReview } from "@/app/actions";

export type ReviewRecipe = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  courseLabel: string | null;
  clientRemoved: boolean;
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

/** Courses in the order they first appear. */
function byCourse<T extends { courseLabel: string | null }>(items: T[]): Array<{ course: string | null; items: T[] }> {
  const groups: Array<{ course: string | null; items: T[] }> = [];
  for (const item of items) {
    const course = item.courseLabel?.trim() || null;
    const group = groups.find((g) => g.course === course);
    if (group) group.items.push(item);
    else groups.push({ course, items: [item] });
  }
  return groups;
}

function CourseHeading({ course }: { course: string | null }) {
  if (!course) return null;
  return (
    <h2 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent-strong)] first:mt-0">
      {course}
    </h2>
  );
}

/** The approved menu: the dishes the client kept. */
export function FinalMenu({ recipes }: { recipes: Array<Omit<ReviewRecipe, "clientRemoved">> }) {
  if (recipes.length === 0) return null;
  return (
    <div className="mt-6">
      {byCourse(recipes).map((group) => (
        <section key={group.course ?? "_"}>
          <CourseHeading course={group.course} />
          <ul className="space-y-2">
            {group.items.map((r) => (
              <li key={r.id} className="rounded-[14px] border border-stone-200 bg-white px-4 py-3">
                <p className="font-semibold text-stone-900">{r.title}</p>
                {r.description && <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{r.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ProposalReviewForm({
  token,
  recipes,
  keepTarget,
  chef,
  firstName,
  preview = false,
}: {
  token: string;
  /** The chef's preview: every button works, nothing is saved or sent. */
  preview?: boolean;
  recipes: ReviewRecipe[];
  /** How many dishes the client's plan calls for, when the menu has extras. */
  keepTarget: number | null;
  chef: string;
  firstName: string;
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
      if (!preview) await submitProposalReview(fd);
      setDone(decision);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Something went wrong sending your answer. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const kept = recipes.filter((r) => !removed.has(r.id));

  if (done) {
    return (
      <div aria-live="polite">
        <div className="mt-8 rounded-[14px] border border-stone-200 bg-white p-6 text-center sm:p-8">
          <h2 className="text-xl text-stone-900" style={{ fontFamily: "var(--font-display, Georgia, 'Times New Roman', serif)" }}>
            Thank you, {firstName}!
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            {done === "approve" ? `You approved this menu. ${chef} has your choices.` : `${chef} will send an updated menu.`}
          </p>
          {preview && (
            <button
              type="button"
              onClick={() => setDone(null)}
              className={`mt-4 min-h-11 rounded-full px-4 text-sm font-medium text-[var(--accent-strong)] hover:underline ${FOCUS}`}
            >
              Preview only, nothing was sent. Start over
            </button>
          )}
        </div>
        {done === "approve" && <FinalMenu recipes={kept} />}
      </div>
    );
  }

  let hint: string | null = null;
  if (keepTarget) {
    const extra = kept.length - keepTarget;
    if (extra > 0) hint = `Remove ${extra} more to pick your favorite ${keepTarget}.`;
    else if (extra === 0) hint = `That's your ${keepTarget}.`;
    else hint = `That's fewer than ${keepTarget} — ${chef} can suggest others.`;
  }

  return (
    <div className="mt-6">
      {byCourse(recipes).map((group) => (
        <section key={group.course ?? "_"}>
          <CourseHeading course={group.course} />
          <ul className="space-y-2">
            {group.items.map((r) => {
              const isRemoved = removed.has(r.id);
              return (
                <li
                  key={r.id}
                  className={`flex items-center gap-3 rounded-[14px] border bg-white p-4 transition ${
                    isRemoved ? "border-stone-200 opacity-60" : "border-stone-200"
                  }`}
                >
                  {r.imageUrl && (
                    <Image
                      src={r.imageUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className={`font-semibold text-stone-900 ${isRemoved ? "line-through" : ""}`}>{r.title}</h3>
                    {r.description && <p className="mt-0.5 line-clamp-2 text-sm text-stone-500">{r.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(r.id)}
                    aria-label={isRemoved ? `Add back ${r.title}` : `Remove ${r.title}`}
                    className={`min-h-11 shrink-0 rounded-xl border px-3.5 text-sm font-medium transition ${FOCUS} ${
                      isRemoved
                        ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent-strong)]"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900"
                    }`}
                  >
                    {isRemoved ? "Add back" : "Remove"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="mt-4 px-1 text-sm text-stone-600" aria-live="polite">
        Keeping {kept.length} of {recipes.length} {recipes.length === 1 ? "dish" : "dishes"}.
        {hint && <span className="ml-1 font-medium text-stone-800">{hint}</span>}
      </p>

      <div className="mt-6">
        <label htmlFor="review-comment" className="text-sm font-medium text-stone-800">
          Anything {chef} should know? <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Allergies, swaps, portion sizes, timing…"
          className={`mt-1.5 min-h-24 w-full rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-900 placeholder:text-stone-400 ${FOCUS}`}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => submit("approve")}
          className={`min-h-12 flex-1 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-50 ${FOCUS}`}
        >
          {busy === "approve" ? "Sending…" : kept.length < recipes.length ? `Approve my ${kept.length} ${kept.length === 1 ? "dish" : "dishes"}` : "Approve this menu"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => submit("changes")}
          className={`min-h-12 flex-1 rounded-xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 ${FOCUS}`}
        >
          {busy === "changes" ? "Sending…" : "Ask for changes"}
        </button>
      </div>
    </div>
  );
}
