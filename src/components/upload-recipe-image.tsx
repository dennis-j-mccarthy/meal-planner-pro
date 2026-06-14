"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function UploadRecipeImage({ recipeId, hasImage }: { recipeId: string; hasImage: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      const fd = new FormData();
      fd.set("image", file);
      try {
        const res = await fetch(`/api/recipes/${recipeId}/upload-image`, {
          method: "POST",
          body: fd,
        });
        if (res.ok) {
          window.location.reload();
        } else {
          alert("Upload failed");
        }
      } finally {
        setUploading(false);
      }
    },
    [recipeId],
  );

  // Paste an image anywhere on the page (⌘V / Ctrl+V) to set the photo.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      // Don't hijack paste while typing into a text field.
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const file = Array.from(e.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith("image/"))
        ?.getAsFile();
      if (file) {
        e.preventDefault();
        handleFile(file);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  // "Paste image" button — reads an image directly from the clipboard.
  const handlePasteClick = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          const ext = type.split("/")[1] || "png";
          await handleFile(new File([blob], `pasted.${ext}`, { type }));
          return;
        }
      }
      alert("No image on the clipboard. Copy an image first, then click Paste image.");
    } catch {
      alert("Couldn't read the clipboard. Copy an image, then press ⌘V on this page.");
    }
  }, [handleFile]);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="button-secondary text-sm disabled:opacity-50"
      >
        {uploading ? "Uploading..." : hasImage ? "Replace photo" : "Upload photo"}
      </button>
      <button
        type="button"
        disabled={uploading}
        onClick={handlePasteClick}
        title="Copy an image, then click here — or press ⌘V anywhere on this page"
        className="button-secondary text-sm disabled:opacity-50"
      >
        Paste image
      </button>
      {hasImage && (
        <button
          type="button"
          className="button-secondary text-sm border-red-200 text-red-600 hover:bg-red-50"
          onClick={async () => {
            if (!confirm("Remove this photo?")) return;
            const res = await fetch(`/api/recipes/${recipeId}/upload-image`, {
              method: "DELETE",
            });
            if (res.ok) window.location.reload();
            else alert("Failed to remove");
          }}
        >
          Remove photo
        </button>
      )}
    </>
  );
}
