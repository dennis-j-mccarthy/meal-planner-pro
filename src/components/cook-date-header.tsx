"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCookDate } from "@/app/billing-actions";

// Top of the cook date page: "<Weekday, Month D>", the client, time · guests ·
// notes, and "Edit" to change the day, time, guests and notes in place (or
// mark the cook date cancelled).
export function CookDateHeader({
  cookDate,
}: {
  cookDate: {
    id: string;
    title: string; // "Monday, November 23"
    ymd: string; // "2026-11-23" (Eastern)
    startTimeLabel: string | null;
    guestCount: number | null;
    serviceNotes: string | null;
    cancelled: boolean;
    client: { id: string; name: string };
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const details = [
    cookDate.startTimeLabel,
    cookDate.guestCount != null
      ? `${cookDate.guestCount} guest${cookDate.guestCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  if (!editing) {
    return (
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">
            {cookDate.title}
            {cookDate.cancelled && (
              <span className="ml-3 align-middle badge badge-muted">Cancelled</span>
            )}
          </h1>
          <p className="mt-2 text-sm">
            <Link
              href={`/clients/${cookDate.client.id}`}
              className="font-semibold text-[var(--accent-strong)] hover:underline"
            >
              {cookDate.client.name}
            </Link>
            {details.length > 0 && <span className="muted"> · {details.join(" · ")}</span>}
          </p>
          {cookDate.serviceNotes && (
            <p className="mt-2 whitespace-pre-line text-sm muted">{cookDate.serviceNotes}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setError("");
            setEditing(true);
          }}
          className="button-secondary shrink-0 self-start"
        >
          Edit
        </button>
      </header>
    );
  }

  return (
    <form
      action={async (formData) => {
        setSaving(true);
        setError("");
        try {
          await updateCookDate(formData);
          setEditing(false);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save");
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="cookDateId" value={cookDate.id} />
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="section-title">Edit cook date</h1>
        <Link href={`/clients/${cookDate.client.id}`} className="text-sm muted hover:underline">
          {cookDate.client.name}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="cd-date" className="mb-1 block text-sm font-medium text-slate-700">
            Date
          </label>
          <input id="cd-date" name="scheduledFor" type="date" required defaultValue={cookDate.ymd} className="field" />
        </div>
        <div>
          <label htmlFor="cd-time" className="mb-1 block text-sm font-medium text-slate-700">
            Time
          </label>
          <input
            id="cd-time"
            name="startTimeLabel"
            placeholder="e.g. 10:00 AM"
            defaultValue={cookDate.startTimeLabel ?? ""}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="cd-guests" className="mb-1 block text-sm font-medium text-slate-700">
            Guests
          </label>
          <input
            id="cd-guests"
            name="guestCount"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            defaultValue={cookDate.guestCount ?? ""}
            className="field"
          />
        </div>
      </div>
      <div>
        <label htmlFor="cd-notes" className="mb-1 block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="cd-notes"
          name="serviceNotes"
          defaultValue={cookDate.serviceNotes ?? ""}
          className="field min-h-20"
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          name="cancelled"
          defaultChecked={cookDate.cancelled}
          className="h-5 w-5 rounded border-slate-300"
        />
        This cook date is cancelled
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="button-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="button-primary">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
