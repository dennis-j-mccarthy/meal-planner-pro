"use client";

import { useState, useRef, useEffect } from "react";
import { updateClient, deleteClient } from "@/app/actions";
import { PreferenceCheckboxes } from "@/components/preference-checkboxes";
import { parsePreferenceList } from "@/lib/preference-options";
import { DishQuotaEditor } from "@/components/dish-quota-editor";
import { parseDishQuota } from "@/lib/dish-quota";
import { ClientBillingFields } from "@/components/client-billing-fields";

interface ClientInitial {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  secondaryEmail: string | null;
  phone: string | null;
  householdLabel: string | null;
  dietaryNotes: string | null;
  inclusions: string | null;
  exclusions: string | null;
  profileNotes: string | null;
  dishQuota: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  billingMode?: string | null;
  defaultRate?: number | null;
  travelFee?: number | null;
}

const GROUP = "text-xs font-bold uppercase tracking-wider text-slate-400";

function Field({
  label,
  optional = false,
  className = "",
  children,
}: {
  label: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {optional && <span className="font-normal text-slate-400"> (optional)</span>}
      </span>
      {children}
    </label>
  );
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
        className="button-secondary"
        title="Edit client"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
        </svg>
        Edit client
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-black/40"
      >
        <form
          className="flex max-h-[90vh] flex-col"
          action={async (formData) => {
            await updateClient(formData);
            setOpen(false);
          }}
        >
          <input type="hidden" name="clientId" value={client.id} />
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <h2 className="section-title">Edit client</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Two columns on wider screens: who and billing on the left, food on the right. */}
          <div className="grid gap-x-10 gap-y-8 overflow-y-auto px-6 py-6 lg:grid-cols-2">
            <div className="space-y-8">
              <section className="space-y-4">
                <h3 className={GROUP}>Contact</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name">
                    <input className="field" name="firstName" defaultValue={client.firstName} required />
                  </Field>
                  <Field label="Last name">
                    <input className="field" name="lastName" defaultValue={client.lastName} required />
                  </Field>
                  <Field label="Email" className="sm:col-span-2">
                    <input className="field" name="email" type="email" defaultValue={client.email ?? ""} required />
                  </Field>
                  <Field label="Second email" optional className="sm:col-span-2">
                    <input
                      className="field"
                      name="secondaryEmail"
                      type="email"
                      defaultValue={client.secondaryEmail ?? ""}
                    />
                  </Field>
                  <Field label="Phone">
                    <input className="field" name="phone" defaultValue={client.phone ?? ""} />
                  </Field>
                  <Field label="Household label" optional>
                    <input className="field" name="householdLabel" defaultValue={client.householdLabel ?? ""} />
                  </Field>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className={GROUP}>Address</h3>
                <div className="grid gap-4 sm:grid-cols-[1fr_5.5rem_7rem]">
                  <Field label="Street" className="sm:col-span-3">
                    <input className="field" name="street" defaultValue={client.street ?? ""} />
                  </Field>
                  <Field label="City">
                    <input className="field" name="city" defaultValue={client.city ?? ""} />
                  </Field>
                  <Field label="State">
                    <input className="field" name="state" defaultValue={client.state ?? ""} />
                  </Field>
                  <Field label="ZIP">
                    <input className="field" name="zip" defaultValue={client.zip ?? ""} />
                  </Field>
                </div>
              </section>

              <div className="grid">
                <ClientBillingFields
                  idPrefix={`edit-client-${client.id}`}
                  billingMode={client.billingMode}
                  defaultRate={client.defaultRate}
                  travelFee={client.travelFee}
                />
              </div>
            </div>

            <div className="space-y-8">
              <section className="space-y-4">
                <h3 className={GROUP}>Food</h3>
                <Field label="Dietary notes">
                  <textarea
                    className="field min-h-24"
                    name="dietaryNotes"
                    placeholder="Preferences, dislikes, allergens"
                    defaultValue={client.dietaryNotes ?? ""}
                  />
                </Field>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-emerald-600">
                    Inclusions — foods they love / want more of
                  </p>
                  <PreferenceCheckboxes
                    name="inclusions"
                    tone="include"
                    selected={parsePreferenceList(client.inclusions)}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-red-600">Exclusions — foods to always avoid</p>
                  <PreferenceCheckboxes
                    name="exclusions"
                    tone="exclude"
                    selected={parsePreferenceList(client.exclusions)}
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className={GROUP}>Dish plan — how many of each per menu</h3>
                <DishQuotaEditor defaultValue={parseDishQuota(client.dishQuota)} />
              </section>

              <Field label="Profile notes" optional>
                <textarea
                  className="field min-h-20"
                  name="profileNotes"
                  placeholder="Anything else worth remembering"
                  defaultValue={client.profileNotes ?? ""}
                />
              </Field>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-white px-6 py-4">
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
              className="whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Delete client
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="button-secondary text-sm">
                Cancel
              </button>
              <button type="submit" className="button-primary text-sm">
                Save changes
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
