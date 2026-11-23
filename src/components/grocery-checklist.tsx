"use client";

import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";
import { setGroceryItemChecked, toggleGroceryItem } from "@/app/grocery-actions";

export type ChecklistItem = {
  key: string;
  name: string;
  amount: string;
  // Second line under the name: dishes (one cook date) or clients (a week).
  detail: string;
  cookDateIds: string[];
};

export type ChecklistGroup = { section: string; items: ChecklistItem[] };

type Props = {
  groups: ChecklistGroup[];
  initialChecked: string[];
  copyText: string;
} & ({ mode: "cookDate"; cookDateId: string } | { mode: "week" });

export function GroceryChecklist(props: Props) {
  const { groups, initialChecked, copyText } = props;
  const [checked, setChecked] = useState<Set<string>>(() => new Set(initialChecked));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function apply(key: string, value: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function toggle(item: ChecklistItem) {
    const want = !checked.has(item.key);
    apply(item.key, want); // optimistic
    setError(null);
    try {
      const res =
        props.mode === "cookDate"
          ? await toggleGroceryItem(props.cookDateId, item.key)
          : await setGroceryItemChecked(item.cookDateIds, item.key, want);
      apply(item.key, res.checked);
    } catch {
      apply(item.key, !want);
      setError("Couldn't save that check. Please try again.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      // Older Safari / insecure context: select-and-copy fallback.
      const ta = document.createElement("textarea");
      ta.value = copyText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap gap-3">
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy list"}
          data-tip={copied ? "Copied" : "Copy list"}
          className="button-icon"
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          aria-label="Print"
          data-tip="Print"
          className="button-icon"
        >
          <Printer aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p className="no-print rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">
          {error}
        </p>
      )}

      {groups.map((group) => {
        // Unchecked first, checked sink to the bottom; A→Z within each.
        const ordered = [...group.items].sort(
          (a, b) => Number(checked.has(a.key)) - Number(checked.has(b.key)),
        );
        const done = group.items.filter((i) => checked.has(i.key)).length;
        return (
          <section
            key={group.section}
            className="grocery-section panel overflow-hidden"
          >
            <div className="flex items-baseline justify-between bg-[var(--accent-light)]/50 px-4 py-2.5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--accent-strong)]">
                {group.section}
              </h2>
              <span className="text-sm text-slate-400">
                {done}/{group.items.length}
              </span>
            </div>
            <ul>
              {ordered.map((item) => {
                const isChecked = checked.has(item.key);
                return (
                  <li key={item.key} className="border-t border-[var(--border-soft)] bg-white">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => toggle(item)}
                      className="grocery-row flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                        style={{
                          borderColor: isChecked ? "var(--accent)" : "#cbd5e1",
                          background: isChecked ? "var(--accent)" : "transparent",
                        }}
                      >
                        {isChecked && (
                          <svg viewBox="0 0 20 20" className="h-3 w-3" fill="white">
                            <path d="M7.6 13.4 4.2 10l-1.2 1.2 4.6 4.6 9.4-9.4-1.2-1.2z" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-base leading-snug ${
                            isChecked ? "text-slate-400 line-through" : "text-slate-800"
                          }`}
                        >
                          {item.amount && <span className="font-semibold">{item.amount} </span>}
                          {item.name}
                        </span>
                        {item.detail && (
                          <span className="mt-0.5 block text-sm text-slate-400">{item.detail}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// Page-local print rules: the app header/nav live in the root layout, so hide
// them here rather than there.
const PRINT_CSS = `
@media print {
  header, nav, .no-print { display: none !important; }
  body { background: #fff !important; }
  main { padding: 0 !important; max-width: none !important; }
  .grocery-section { break-inside: avoid; border-radius: 0; }
  .grocery-row { min-height: 0 !important; padding-top: 4px !important; padding-bottom: 4px !important; }
}
`;

export function GroceryPrintStyles() {
  return <style>{PRINT_CSS}</style>;
}
