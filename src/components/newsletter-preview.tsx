"use client";

import { useState } from "react";

export function NewsletterPreview({ html }: { html: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(html);
      setState("copied");
      setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2400);
    }
  }

  return (
    <button onClick={handleCopy} className="button-primary text-sm">
      {state === "copied"
        ? "Copied!"
        : state === "error"
          ? "Copy failed"
          : "Copy HTML"}
    </button>
  );
}
