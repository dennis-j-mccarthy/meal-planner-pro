"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateNutritionAction } from "@/app/actions";

// Generates (or recalculates) AI-estimated nutrition for a recipe.
export function NutritionButton({
  recipeId,
  hasNutrition,
}: {
  recipeId: string;
  hasNutrition: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("recipeId", recipeId);
      await generateNutritionAction(fd);
      router.refresh();
    } catch {
      alert("Couldn't estimate nutrition. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      className="button-secondary text-sm gap-1 disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
      {busy ? "Estimating…" : hasNutrition ? "Recalculate nutrition" : "Nutrition & calories"}
    </button>
  );
}
