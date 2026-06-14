"use client";

import { useState } from "react";
import {
  DEFAULT_DISH_CATEGORIES,
  serializeDishQuota,
  totalDishes,
  type DishQuotaRow,
} from "@/lib/dish-quota";

// Editable list of dish categories + counts. Serializes to a hidden input named
// "dishQuota" so it submits with the surrounding client form.
export function DishQuotaEditor({ defaultValue }: { defaultValue: DishQuotaRow[] }) {
  const [rows, setRows] = useState<DishQuotaRow[]>(
    defaultValue.length > 0
      ? defaultValue
      : DEFAULT_DISH_CATEGORIES.map((category) => ({ category, count: 0 })),
  );

  function setRow(index: number, patch: Partial<DishQuotaRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { category: "", count: 0 }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <input type="hidden" name="dishQuota" value={serializeDishQuota(rows) ?? ""} />

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="field flex-1"
              value={row.category}
              placeholder="Category (e.g. Entrées)"
              onChange={(e) => setRow(i, { category: e.target.value })}
            />
            <input
              className="field w-20 text-center"
              type="number"
              min={0}
              value={row.count}
              onChange={(e) => setRow(i, { count: Number(e.target.value) })}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              title="Remove category"
              className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="text-xs font-semibold text-[var(--accent-strong,#b45309)] hover:underline"
        >
          + Add category
        </button>
        <span className="text-xs text-slate-400">
          {totalDishes(rows)} dishes total
        </span>
      </div>
    </div>
  );
}
