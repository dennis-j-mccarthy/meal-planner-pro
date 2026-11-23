"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveGroceriesBought, setGroceriesDone } from "@/app/taste-actions";

// Top of the Groceries step. "Groceries bought" opens a short form: what was
// spent and photos of the receipts. Afterwards it stays as a summary (date,
// amount, receipt thumbnails) with Edit and Undo bought. The amount goes on
// the invoice as "Groceries".

const MAX_EDGE = 1600; // px; a phone photo shrinks to a few hundred KB

/** Shrink a photo to a JPEG before upload. Falls back to the original file. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function GroceriesBought({
  cookDateId,
  boughtLabel,
  cost,
  receiptIds,
  primary,
}: {
  cookDateId: string;
  /** "Nov 23, 2026" once bought, else null. */
  boughtLabel: string | null;
  cost: number | null;
  receiptIds: string[];
  /** This is the step Beth acts on next. */
  primary: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(cost != null ? cost.toFixed(2) : "");
  const [receipts, setReceipts] = useState(receiptIds);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const src = (id: string) => `/api/cook-dates/${cookDateId}/receipts/${id}`;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      try {
        const fd = new FormData();
        const blob = await shrink(file);
        fd.set("receipt", blob, "receipt.jpg");
        const res = await fetch(`/api/cook-dates/${cookDateId}/receipts`, { method: "POST", body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Upload failed");
        setReceipts((prev) => [...prev, body.id as string]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removePhoto(id: string) {
    setReceipts((prev) => prev.filter((r) => r !== id));
    await fetch(src(id), { method: "DELETE" }).catch(() => undefined);
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await saveGroceriesBought(cookDateId, amount);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const thumbs = (removable: boolean) =>
    receipts.length > 0 && (
      <ul className="flex flex-wrap gap-3">
        {receipts.map((id) => (
          <li key={id} className="relative">
            <a href={src(id)} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, kitchen-only image route */}
              <img
                src={src(id)}
                alt="Grocery receipt"
                className="h-24 w-20 rounded-lg border border-[var(--line)] bg-white object-cover object-top"
              />
            </a>
            {removable && (
              <button
                type="button"
                onClick={() => removePhoto(id)}
                aria-label="Remove this receipt"
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-white text-sm text-slate-500 shadow-sm hover:text-slate-800"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    );

  // ── Not bought yet ──
  if (!editing && !boughtLabel) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink">Bought the groceries? Add what you spent and a photo of the receipt.</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`${primary ? "button-primary" : "button-secondary"} shrink-0`}
        >
          Groceries bought
        </button>
      </div>
    );
  }

  // ── Summary ──
  if (!editing) {
    return (
      <div className="space-y-4 rounded-xl border border-[var(--line)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">
            <span className="font-semibold">Bought {boughtLabel}</span>
            <span className="muted">
              {" · "}
              {cost != null
                ? `$${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent`
                : "Amount not entered"}
              {" · "}
              {receipts.length === 0 ? "No receipt" : `${receipts.length} receipt${receipts.length === 1 ? "" : "s"}`}
            </span>
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className="button-secondary">
              Edit
            </button>
            <button
              type="button"
              onClick={async () => {
                await setGroceriesDone(cookDateId, false);
                router.refresh();
              }}
              className="button-secondary"
            >
              Undo bought
            </button>
          </div>
        </div>
        {thumbs(false)}
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="space-y-5 rounded-xl border border-[var(--accent)] bg-[var(--accent-light)]/30 p-4 sm:p-5">
      <div>
        <label htmlFor={`spent-${cookDateId}`} className="text-sm font-semibold text-ink">
          What did you spend?
        </label>
        <div className="relative mt-2 max-w-[12rem]">
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base muted">
            $
          </span>
          <input
            id={`spent-${cookDateId}`}
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="0.00"
            className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-white pl-7 pr-3 text-base text-ink"
          />
        </div>
        <p className="mt-1.5 text-xs muted">Goes on the invoice as &ldquo;Groceries&rdquo;.</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">Receipt photos</p>
        {thumbs(true)}
        <div>
          <input
            ref={fileRef}
            id={`receipt-${cookDateId}`}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => addPhotos(e.target.files)}
          />
          <label htmlFor={`receipt-${cookDateId}`} className="button-secondary cursor-pointer">
            {uploading > 0 ? "Uploading…" : receipts.length > 0 ? "Add another photo" : "Add receipt photo"}
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
        <button type="button" onClick={save} disabled={saving || uploading > 0} className="button-primary disabled:opacity-60">
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
            setAmount(cost != null ? cost.toFixed(2) : "");
          }}
          className="button-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
