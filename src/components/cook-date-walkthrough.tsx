"use client";

import { useState } from "react";
import { STEP_KEYS, STEP_LABEL, type CookDateProgress, type StepKey } from "@/lib/cook-date-progress";

// The steps for one cook date, with the panel for one step underneath. Every
// step number is a button: it opens on the current step, and any step (done or
// not) can be opened to look back or jump ahead. Phones: a row of four, then
// three.
// Wider screens: one row.
export function CookDateWalkthrough({
  progress,
  panels,
  cancelledNote,
}: {
  progress: CookDateProgress;
  panels: Record<StepKey, React.ReactNode>;
  cancelledNote: React.ReactNode;
}) {
  const { done, skipped, current, cancelled } = progress;
  const [selected, setSelected] = useState<StepKey>(current ?? "paid");

  return (
    <section aria-label="Steps for this cook date" className="panel space-y-6 p-5 sm:p-6">
      <ol className={`grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-7 ${cancelled ? "opacity-50" : ""}`}>
        {STEP_KEYS.map((key, i) => {
          const isDone = done[key];
          const isSkipped = !!skipped[key];
          const isCurrent = current === key;
          const isSelected = selected === key;
          return (
            <li key={key} className="relative">
              {/* Connector to the next step (same row only) */}
              {i < STEP_KEYS.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-[calc(50%_+_1.25rem)] right-[calc(-50%_+_0.75rem)] top-[1.375rem] h-px ${
                    i === 3 ? "hidden sm:block" : ""
                  } ${isDone && done[STEP_KEYS[i + 1]] ? "bg-emerald-300" : "bg-[var(--line)]"}`}
                />
              )}
              <button
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${i + 1}, ${STEP_LABEL[key]}${
                  isSkipped ? " (skipped)" : isDone ? " (done)" : isCurrent ? " (next)" : ""
                }`}
                className="group relative flex w-full flex-col items-center gap-2 rounded-xl px-1 py-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                    isSelected ? "ring-4 ring-[var(--accent-light)]" : "group-hover:ring-4 group-hover:ring-[var(--surface-raised)]"
                  } ${
                    isCurrent
                      ? "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-white shadow-md"
                      : isSkipped
                        ? "border border-[var(--line)] bg-[var(--card)] text-[var(--muted-fg)]"
                        : isDone
                          ? "bg-emerald-600 text-white"
                          : "border border-[var(--line)] bg-[var(--card)] text-[var(--muted-fg)]"
                  }`}
                >
                  {isSkipped ? (
                    "–"
                  ) : isDone && !isCurrent ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={`text-xs font-semibold leading-tight ${
                    isSelected
                      ? "text-ink underline decoration-2 underline-offset-4"
                      : isCurrent
                        ? "text-[var(--accent-strong)]"
                        : isDone && !isSkipped
                          ? "text-emerald-700"
                          : "text-[var(--muted-fg)]"
                  }`}
                >
                  {STEP_LABEL[key]}
                  <span className="sr-only">
                    {isSkipped ? " (skipped)" : isDone ? " (done)" : isCurrent ? " (next)" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-[var(--line)] pt-5">
        {cancelled && <div className="mb-4">{cancelledNote}</div>}
        {panels[selected]}
      </div>
    </section>
  );
}
