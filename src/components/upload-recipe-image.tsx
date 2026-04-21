"use client";

import { useRef, useState } from "react";

export function UploadRecipeImage({ recipeId, hasImage }: { recipeId: string; hasImage: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
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
  }

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
        {uploading ? "Uploading..." : "Upload photo"}
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
