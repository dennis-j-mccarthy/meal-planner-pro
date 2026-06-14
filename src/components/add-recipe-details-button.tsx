"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  generateRecipeDetailsAction,
  generateRecipeImageAction,
} from "@/app/actions";

// Shown when a recipe is just a blurb (no ingredients/steps). AI-generates the
// ingredients + steps from the blurb, then offers to generate an AI photo.
export function AddRecipeDetailsButton({
  recipeId,
  hasImage,
}: {
  recipeId: string;
  hasImage: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("Add recipe");

  async function run() {
    setBusy(true);
    setLabel("Writing ingredients & steps…");
    try {
      const fd = new FormData();
      fd.set("recipeId", recipeId);
      await generateRecipeDetailsAction(fd);
    } catch {
      setBusy(false);
      setLabel("Add recipe");
      alert("Couldn't generate the recipe. Please try again.");
      return;
    }

    // Offer an AI photo if the recipe doesn't have one yet.
    if (!hasImage && window.confirm("Recipe added! Generate an AI photo for this dish too?")) {
      setLabel("Creating a photo…");
      try {
        const ifd = new FormData();
        ifd.set("recipeId", recipeId);
        await generateRecipeImageAction(ifd);
      } catch {
        alert("The recipe was added, but the photo couldn't be generated.");
      }
    }

    setBusy(false);
    setLabel("Add recipe");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      className="button-primary text-sm gap-1 disabled:opacity-50"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      </svg>
      {label}
    </button>
  );
}
