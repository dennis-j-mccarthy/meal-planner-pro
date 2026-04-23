"use client";

import { useState, useRef, useEffect } from "react";
import { updateClient, deleteClient } from "@/app/actions";

interface ClientInitial {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  householdLabel: string | null;
  dietaryNotes: string | null;
  address: string | null;
}

export function EditClientModal({ client }: { client: ClientInitial }) {
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="button-secondary text-xs px-3 py-1.5"
        title="Edit client"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
        </svg>
        Edit
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-full max-w-lg max-h-[90vh] rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-black/40 overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Edit client</h2>
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
              await updateClient(formData);
              setOpen(false);
            }}
          >
            <input type="hidden" name="clientId" value={client.id} />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="field"
                name="firstName"
                placeholder="First name"
                defaultValue={client.firstName}
                required
              />
              <input
                className="field"
                name="lastName"
                placeholder="Last name"
                defaultValue={client.lastName}
                required
              />
              <input
                className="field md:col-span-2"
                name="email"
                type="email"
                placeholder="Email (optional)"
                defaultValue={client.email ?? ""}
              />
              <input
                className="field"
                name="phone"
                placeholder="Phone"
                defaultValue={client.phone ?? ""}
              />
              <input
                className="field"
                name="householdLabel"
                placeholder="Household label"
                defaultValue={client.householdLabel ?? ""}
              />
              <textarea
                className="field md:col-span-2 min-h-24"
                name="dietaryNotes"
                placeholder="Dietary preferences, dislikes, allergen notes"
                defaultValue={client.dietaryNotes ?? ""}
              />
              <textarea
                className="field md:col-span-2 min-h-20"
                name="address"
                placeholder="Service address or neighborhood"
                defaultValue={client.address ?? ""}
              />
            </div>
            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (
                    !confirm(
                      `Delete ${client.firstName} ${client.lastName}? This removes the client and cannot be undone.`,
                    )
                  )
                    return;
                  const fd = new FormData();
                  fd.set("clientId", client.id);
                  await deleteClient(fd);
                  setOpen(false);
                }}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Delete client
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="button-secondary text-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="button-primary text-sm">
                  Save changes
                </button>
              </div>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
