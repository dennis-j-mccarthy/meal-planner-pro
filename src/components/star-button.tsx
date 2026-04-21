"use client";

import { useTransition } from "react";
import { toggleRecipeStar } from "@/app/actions";

type StarButtonProps = {
  recipeId: string;
  starred: boolean;
  size?: "sm" | "md";
};

export function StarButton({ recipeId, starred, size = "md" }: StarButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const formData = new FormData();
    formData.set("recipeId", recipeId);

    startTransition(async () => {
      await toggleRecipeStar(formData);
    });
  }

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`shrink-0 rounded-md p-1 transition disabled:opacity-50 ${
        starred
          ? "text-amber-400 hover:text-amber-500"
          : "text-slate-300 hover:text-amber-400"
      }`}
      title={starred ? "Unstar recipe" : "Star recipe"}
    >
      <svg
        className={iconSize}
        viewBox="0 0 24 24"
        fill={starred ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={starred ? 0 : 2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
        />
      </svg>
    </button>
  );
}
