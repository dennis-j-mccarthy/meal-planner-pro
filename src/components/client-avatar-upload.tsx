"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientBadge } from "@/components/client-badge";

// The client's badge on their page, with Add photo / Change photo and Remove.
// The photo is cropped to the centre square and shrunk to 320px before upload.

const EDGE = 320;

async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = EDGE;
  canvas.height = EDGE;
  canvas
    .getContext("2d")
    ?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, EDGE, EDGE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not read that photo");
  return blob;
}

export function ClientAvatarUpload({
  clientId,
  firstName,
  lastName,
  avatarUpdatedAt,
}: {
  clientId: string;
  firstName: string;
  lastName: string;
  avatarUpdatedAt: number | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(avatarUpdatedAt);
  const [busy, setBusy] = useState<"" | "upload" | "remove">("");
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const fd = new FormData();
      fd.set("photo", await squareJpeg(file), "photo.jpg");
      const res = await fetch(`/api/clients/${clientId}/avatar`, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Upload failed");
      setVersion(body.version as number);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    setError("");
    const res = await fetch(`/api/clients/${clientId}/avatar`, { method: "DELETE" }).catch(() => null);
    setBusy("");
    if (!res?.ok) {
      setError("Could not remove the photo");
      return;
    }
    setVersion(null);
    router.refresh();
  }

  const inputId = `avatar-${clientId}`;
  return (
    <div className="flex items-center gap-4">
      <label htmlFor={inputId} className="group relative cursor-pointer rounded-full" title="Change photo">
        <ClientBadge clientId={clientId} firstName={firstName} lastName={lastName} avatarUpdatedAt={version} size="lg" />
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-white text-slate-600 shadow-sm group-hover:text-[var(--accent-strong)] [&>svg]:h-3.5 [&>svg]:w-3.5">
          <Camera aria-hidden="true" />
        </span>
      </label>
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div className="flex flex-col items-start gap-1 text-sm">
        <label htmlFor={inputId} className="cursor-pointer font-semibold text-[var(--accent-strong)] hover:underline">
          {busy === "upload" ? "Uploading…" : version ? "Change photo" : "Add photo"}
        </label>
        {version && (
          <button
            type="button"
            onClick={remove}
            disabled={!!busy}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-red-600 disabled:opacity-60 [&>svg]:h-3.5 [&>svg]:w-3.5"
          >
            <Trash2 aria-hidden="true" />
            {busy === "remove" ? "Removing…" : "Remove photo"}
          </button>
        )}
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </div>
  );
}
