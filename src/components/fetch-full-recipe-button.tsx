"use client";

import { useState } from "react";

export function FetchFullRecipeButton({
  recipeId,
  sourceUrl,
}: {
  recipeId: string;
  sourceUrl: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleFetch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}/fetch-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleFetch}
      disabled={loading}
      className="button-secondary text-sm disabled:opacity-50"
    >
      {loading ? "Fetching..." : "Fetch full recipe"}
    </button>
  );
}
