import { STEP_KEYS, STEP_LABEL, type CookDateProgress } from "@/lib/cook-date-progress";

// Six steps for one cook date: Plan → Proposed → Accepted → Bon Appetit →
// Invoice → Paid. Done steps get a check, the current step is highlighted.
// Phones: two rows of three. Wider screens: one row.
export function CookDateProgressBar({ progress }: { progress: CookDateProgress }) {
  const { done, current, cancelled } = progress;
  return (
    <ol
      aria-label="Steps for this cook date"
      className={`grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-6 ${cancelled ? "opacity-50" : ""}`}
    >
      {STEP_KEYS.map((key, i) => {
        const isDone = done[key];
        const isCurrent = current === key;
        return (
          <li
            key={key}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex flex-col items-center gap-2 text-center"
          >
            {/* Connector to the next step (same row only) */}
            {i < STEP_KEYS.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[calc(50%_+_1.25rem)] right-[calc(-50%_+_0.75rem)] top-4 h-px ${
                  i === 2 ? "hidden sm:block" : ""
                } ${isDone && done[STEP_KEYS[i + 1]] ? "bg-emerald-300" : "bg-[var(--line)]"}`}
              />
            )}
            <span
              className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                isCurrent
                  ? "bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-white shadow-md ring-4 ring-[var(--accent-light)]"
                  : isDone
                    ? "bg-emerald-600 text-white"
                    : "border border-[var(--line)] bg-[var(--card)] text-[var(--muted-fg)]"
              }`}
            >
              {isDone && !isCurrent ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span
              className={`text-xs font-semibold leading-tight ${
                isCurrent ? "text-[var(--accent-strong)]" : isDone ? "text-emerald-700" : "text-[var(--muted-fg)]"
              }`}
            >
              {STEP_LABEL[key]}
              <span className="sr-only">{isDone ? " (done)" : isCurrent ? " (next)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
