"use client";

import { useEffect, useState } from "react";

// A progress bar for work whose length we only roughly know (building a Bon
// Appetit, making a PDF). It moves quickly at first and slows as it nears the
// end, never reaching 100% on its own; `done` fills it. `stages` are plain
// words for what is happening, shown in turn as the bar moves.
export function ProgressBar({
  expectedMs,
  stages,
  done = false,
  label,
}: {
  /** Roughly how long the work takes; the bar is ~85% full by then. */
  expectedMs: number;
  stages: string[];
  done?: boolean;
  /** Accessible name for the bar. */
  label: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (done) return;
    const start = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - start), 150);
    return () => clearInterval(timer);
  }, [done]);

  const pct = done ? 100 : Math.min(96, 100 * (1 - Math.exp((-1.9 * elapsed) / expectedMs)));
  const stage = done ? stages[stages.length - 1] : stages[Math.min(stages.length - 1, Math.floor((pct / 100) * stages.length))];

  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={stage}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--accent-light)]"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-sm muted" aria-live="polite">
        {stage}
      </p>
    </div>
  );
}
