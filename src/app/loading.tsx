// Quiet placeholder while a page loads: a title bar and a few soft rows.
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-3">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--line)] motion-reduce:animate-none" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-[var(--line)] opacity-70 motion-reduce:animate-none" />
      </div>
      <div className="panel divide-y divide-[var(--line)]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-5 py-5">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/5 animate-pulse rounded bg-[var(--line)] motion-reduce:animate-none" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-[var(--line)] opacity-70 motion-reduce:animate-none" />
            </div>
            <div className="h-9 w-24 animate-pulse rounded-lg bg-[var(--line)] opacity-70 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  );
}
