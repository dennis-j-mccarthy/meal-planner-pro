"use client";

import { useState } from "react";
import { submitTasteFeedback } from "@/app/taste-actions";
import { TASTE_RATING_LABEL, TASTE_RATINGS, type TasteRating } from "@/lib/taste-ratings";

type Dish = { recipeId: string; title: string; rating: TasteRating | null };

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";

export function TasteForm({
  token,
  dishes,
  initialOverall,
  initialComment,
  alreadySubmitted,
}: {
  token: string;
  dishes: Dish[];
  initialOverall: number | null;
  initialComment: string;
  alreadySubmitted: boolean;
}) {
  const [overall, setOverall] = useState<number | null>(initialOverall);
  const [ratings, setRatings] = useState<Record<string, TasteRating | null>>(
    Object.fromEntries(dishes.map((d) => [d.recipeId, d.rating])),
  );
  const [comment, setComment] = useState(initialComment);
  const [stage, setStage] = useState<"form" | "sending" | "done">(alreadySubmitted ? "done" : "form");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStage("sending");
    setError("");
    const fd = new FormData();
    fd.set("token", token);
    if (overall) fd.set("overall", String(overall));
    fd.set("comment", comment);
    for (const [id, r] of Object.entries(ratings)) if (r) fd.set(`dish_${id}`, r);
    try {
      const res = await submitTasteFeedback(fd);
      if (res.ok) setStage("done");
      else {
        setError(res.error);
        setStage("form");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStage("form");
    }
  }

  if (stage === "done") {
    return (
      <div className="mt-8 rounded-[14px] border border-stone-200 bg-white p-6 text-center sm:p-8">
        <p className="text-xl text-stone-900">Thank you!</p>
        <p className="mt-2 text-sm text-stone-600">Your answers went straight to your chef.</p>
        <button
          type="button"
          onClick={() => setStage("form")}
          className={`mt-5 min-h-11 rounded-full px-4 text-sm font-medium text-[var(--accent-strong)] underline-offset-4 hover:underline ${FOCUS}`}
        >
          Change my answers
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-8">
      <section className="rounded-[14px] border border-stone-200 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold text-stone-900">Overall</h2>
        <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Overall, 1 to 5 stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={overall === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setOverall(n)}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-3xl leading-none transition ${FOCUS} ${
                overall && n <= overall ? "text-amber-400" : "text-stone-300 hover:text-amber-200"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </section>

      {dishes.length > 0 && (
        <section className="rounded-[14px] border border-stone-200 bg-white p-5 sm:p-6">
          <h2 className="text-base font-semibold text-stone-900">Each dish</h2>
          <ul className="mt-2 divide-y divide-stone-100">
            {dishes.map((d) => (
              <li key={d.recipeId} className="py-4">
                <p className="text-sm font-medium text-stone-900">{d.title}</p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={d.title}>
                  {TASTE_RATINGS.map((r) => {
                    const on = ratings[d.recipeId] === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setRatings((prev) => ({ ...prev, [d.recipeId]: on ? null : r }))}
                        className={`min-h-11 rounded-full border px-4 text-sm font-medium transition ${FOCUS} ${
                          on
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                        }`}
                      >
                        {TASTE_RATING_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-[14px] border border-stone-200 bg-white p-5 sm:p-6">
        <label htmlFor="taste-comment" className="text-base font-semibold text-stone-900">
          Anything I should know for next time?
        </label>
        <textarea
          id="taste-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={4000}
          className={`mt-3 w-full rounded-xl border border-stone-200 p-3 text-base text-stone-900 ${FOCUS}`}
        />
      </section>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="text-center">
        <button
          type="submit"
          disabled={stage === "sending"}
          className={`min-h-12 rounded-full bg-[var(--accent)] px-8 text-base font-semibold text-white shadow-sm transition hover:bg-[var(--accent-strong)] disabled:opacity-60 ${FOCUS}`}
        >
          {stage === "sending" ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}
