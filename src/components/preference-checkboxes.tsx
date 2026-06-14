"use client";

import { PREFERENCE_OPTIONS } from "@/lib/preference-options";

// Native checkboxes styled as toggle chips. Multiple inputs share one `name`,
// so the server action receives them via formData.getAll(name) — no client
// state needed.
export function PreferenceCheckboxes({
  name,
  selected,
  tone,
}: {
  name: string;
  selected: string[];
  tone: "include" | "exclude";
}) {
  const set = new Set(selected.map((s) => s.toLowerCase()));
  const checkedClasses =
    tone === "include"
      ? "peer-checked:border-emerald-300 peer-checked:bg-emerald-50 peer-checked:text-emerald-700"
      : "peer-checked:border-red-300 peer-checked:bg-red-50 peer-checked:text-red-700";

  return (
    <div className="flex flex-wrap gap-1.5">
      {PREFERENCE_OPTIONS.map((opt) => (
        <label key={opt} className="cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={opt}
            defaultChecked={set.has(opt.toLowerCase())}
            className="peer sr-only"
          />
          <span
            className={`inline-block rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 ${checkedClasses}`}
          >
            {opt}
          </span>
        </label>
      ))}
    </div>
  );
}
