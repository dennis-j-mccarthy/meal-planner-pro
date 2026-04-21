type StatusBadgeProps = {
  label: string;
};

const styles: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  sent: "bg-blue-50 text-blue-700 ring-blue-600/20",
  processing: "bg-blue-50 text-blue-700 ring-blue-600/20",
  queued: "bg-amber-50 text-amber-700 ring-amber-600/20",
  starter: "bg-amber-50 text-amber-700 ring-amber-600/20",
  draft: "bg-slate-50 text-slate-600 ring-slate-500/20",
  archived: "bg-slate-50 text-slate-600 ring-slate-500/20",
  proposed: "bg-violet-50 text-violet-700 ring-violet-600/20",
  scheduled: "bg-violet-50 text-violet-700 ring-violet-600/20",
  revisions: "bg-rose-50 text-rose-700 ring-rose-600/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export function StatusBadge({ label }: StatusBadgeProps) {
  const key = Object.keys(styles).find((item) => label.toLowerCase().includes(item));

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        key ? styles[key] : "bg-slate-50 text-slate-600 ring-slate-500/20"
      }`}
    >
      {label}
    </span>
  );
}
