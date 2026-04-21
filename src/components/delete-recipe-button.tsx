"use client";

import { deleteRecipe } from "@/app/actions";

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  async function handleDelete() {
    if (!confirm("Delete this recipe? This cannot be undone.")) return;
    const fd = new FormData();
    fd.set("recipeId", recipeId);
    await deleteRecipe(fd);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="button-secondary text-sm border-red-200 text-red-600 hover:bg-red-50"
    >
      Delete
    </button>
  );
}
