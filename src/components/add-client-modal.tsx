"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/app/actions";

export function AddClientModal() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

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
        className="button-primary text-sm gap-1"
        title="Add a client"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add client
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-full max-w-lg max-h-[90vh] rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-black/40 overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Add a client</h2>
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
            action={async (formData) => {
              await createClient(formData);
              setOpen(false);
            }}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <input className="field" name="firstName" placeholder="First name" required />
              <input className="field" name="lastName" placeholder="Last name" required />
              <input className="field md:col-span-2" name="email" type="email" placeholder="Email (optional)" />
              <input className="field" name="phone" placeholder="Phone" />
              <input className="field" name="householdLabel" placeholder="Household label" />
              <textarea
                className="field md:col-span-2 min-h-24"
                name="dietaryNotes"
                placeholder="Dietary preferences, dislikes, allergen notes"
              />
              <textarea
                className="field md:col-span-2 min-h-20"
                name="address"
                placeholder="Service address or neighborhood"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="button-secondary text-sm"
              >
                Cancel
              </button>
              <button type="submit" className="button-primary text-sm">
                Save client
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
