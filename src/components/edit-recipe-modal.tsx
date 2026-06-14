"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateRecipe } from "@/app/actions";

type EditableRecipe = {
  id: string;
  title: string;
  cuisine: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string | null;
  dietaryFlags: string | null;
  description: string | null;
  ingredientsText: string | null;
  instructionsText: string | null;
};

export function EditRecipeModal({ recipe }: { recipe: EditableRecipe }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="button-secondary text-sm gap-1"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
        Edit recipe
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-black/40 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Edit recipe</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          action={async (fd) => {
            setSaving(true);
            try {
              await updateRecipe(fd);
              setOpen(false);
              router.refresh();
            } finally {
              setSaving(false);
            }
          }}
          className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-130px)]"
        >
          <input type="hidden" name="recipeId" value={recipe.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <input className="field md:col-span-2" name="title" placeholder="Recipe title" required defaultValue={recipe.title} />
            <input className="field" name="cuisine" placeholder="Cuisine" defaultValue={recipe.cuisine ?? ""} />
            <input className="field" name="servings" placeholder="Servings" type="number" min="1" defaultValue={recipe.servings ?? ""} />
            <input className="field" name="prepMinutes" placeholder="Prep minutes" type="number" min="0" defaultValue={recipe.prepMinutes ?? ""} />
            <input className="field" name="cookMinutes" placeholder="Cook minutes" type="number" min="0" defaultValue={recipe.cookMinutes ?? ""} />
            <input className="field md:col-span-2" name="tags" placeholder="Tags: high-protein, family-style" defaultValue={recipe.tags ?? ""} />
            <input className="field md:col-span-2" name="dietaryFlags" placeholder="Dietary flags: gluten-free, dairy-free" defaultValue={recipe.dietaryFlags ?? ""} />
            <textarea className="field md:col-span-2 min-h-24" name="description" placeholder="Recipe summary" defaultValue={recipe.description ?? ""} />
            <textarea className="field md:col-span-2 min-h-28" name="ingredientsText" placeholder={"Ingredients, one per line"} defaultValue={recipe.ingredientsText ?? ""} />
            <textarea className="field md:col-span-2 min-h-28" name="instructionsText" placeholder={"Instructions, one step per line"} defaultValue={recipe.instructionsText ?? ""} />
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="button-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="button-primary text-sm disabled:opacity-50">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
