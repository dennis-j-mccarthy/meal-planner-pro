"use client";

import Image from "next/image";
import Link from "next/link";
import { StarButton } from "./star-button";

type RecipeCardRecipe = {
  id: string;
  title: string;
  cuisine: string | null;
  description: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  ingredientsText: string | null;
  tags: string | null;
  dietaryFlags: string | null;
  timingLabel: string;
  starred: boolean;
  imageUrl: string | null;
};

type RecipeCardProps = {
  recipe: RecipeCardRecipe;
};

function iconFor(title: string, cuisine: string | null) {
  const text = `${title} ${cuisine || ""}`.toLowerCase();
  if (text.match(/salad|green|arugula|kale|spinach/)) return "🥗";
  if (text.match(/fish|salmon|tuna|shrimp|seafood|cod|halibut/)) return "🐟";
  if (text.match(/chicken|poultry|turkey/)) return "🍗";
  if (text.match(/beef|steak|burger/)) return "🥩";
  if (text.match(/pasta|noodle|spaghetti|penne/)) return "🍝";
  if (text.match(/soup|stew|chowder|broth/)) return "🍲";
  if (text.match(/dessert|cake|cookie|pie|sweet|chocolate/)) return "🍰";
  if (text.match(/smoothie|juice|drink|cocktail|latte/)) return "🥤";
  if (text.match(/breakfast|oat|granola|pancake|waffle|egg/)) return "🥞";
  if (text.match(/pizza|flatbread/)) return "🍕";
  if (text.match(/taco|burrito|mexican|fajita/)) return "🌮";
  if (text.match(/vegetable|vegan|vegetarian|plant/)) return "🥬";
  if (text.match(/rice|grain|quinoa|bowl/)) return "🍚";
  if (text.match(/bread|sandwich|toast|bagel/)) return "🥪";
  if (text.match(/fruit|berry|apple|orange|banana/)) return "🍓";
  return "🍽️";
}

function firstTag(...values: Array<string | null | undefined>) {
  for (const v of values) {
    if (v) {
      const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts[0];
    }
  }
  return null;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const icon = iconFor(recipe.title, recipe.cuisine);
  const topTag = firstTag(recipe.tags, recipe.dietaryFlags);

  return (
    <div
      style={{ backgroundColor: "#ffffff" }}
      className="group relative break-inside-avoid mb-5 flex flex-col rounded-2xl border border-slate-200 overflow-hidden hover:border-[var(--accent)]/40 hover:shadow-lg transition-all duration-300 cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/recipe-id", recipe.id);
        e.dataTransfer.setData("text/plain", recipe.title);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <Link
        href={`/recipes/${recipe.id}`}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">View {recipe.title}</span>
      </Link>

      {/* Image — only when present */}
      {recipe.imageUrl && (
        <div className="relative z-0 overflow-hidden">
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            width={500}
            height={320}
            className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 p-4 flex-1">
        {/* Header row: icon (no image) + star */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {!recipe.imageUrl && (
              <span className="text-2xl leading-none shrink-0">{icon}</span>
            )}
            {recipe.cuisine && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                {recipe.cuisine}
              </p>
            )}
          </div>
          <div className="pointer-events-auto shrink-0">
            <StarButton recipeId={recipe.id} starred={recipe.starred} size="sm" />
          </div>
        </div>

        {/* Title */}
        <h4 className="font-bold leading-snug mb-2 group-hover:text-[var(--accent)]" style={{ color: "#0f172a" }}>
          {recipe.title}
        </h4>

        {/* Description — variable length, shown in full for masonry */}
        {recipe.description && (
          <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
            {recipe.description}
          </p>
        )}

        {/* Footer row: timing, servings, tag */}
        {(recipe.timingLabel !== "Timing not set" || recipe.servings || topTag) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 text-xs">
            {recipe.timingLabel !== "Timing not set" && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                {recipe.timingLabel}
              </span>
            )}
            {recipe.servings && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
                {recipe.servings}
              </span>
            )}
            {topTag && (
              <span className="ml-auto inline-flex rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                {topTag}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
