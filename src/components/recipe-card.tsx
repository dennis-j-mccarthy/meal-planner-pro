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

// Deterministic placeholder theme per recipe — each with distinct gradient + food icon
const PLACEHOLDER_THEMES = [
  { gradient: "from-orange-400 via-rose-400 to-pink-500", icon: "🍅" },
  { gradient: "from-amber-400 via-orange-500 to-red-500", icon: "🥕" },
  { gradient: "from-teal-400 via-cyan-500 to-sky-600", icon: "🐟" },
  { gradient: "from-lime-400 via-green-500 to-emerald-600", icon: "🥗" },
  { gradient: "from-violet-400 via-purple-500 to-fuchsia-600", icon: "🍆" },
  { gradient: "from-pink-400 via-rose-500 to-red-600", icon: "🍓" },
  { gradient: "from-sky-400 via-blue-500 to-indigo-600", icon: "🫐" },
  { gradient: "from-yellow-300 via-amber-400 to-orange-500", icon: "🍋" },
  { gradient: "from-emerald-400 via-teal-500 to-cyan-600", icon: "🥑" },
  { gradient: "from-red-400 via-pink-500 to-purple-600", icon: "🌶️" },
  { gradient: "from-stone-400 via-amber-600 to-orange-700", icon: "🥖" },
  { gradient: "from-indigo-400 via-purple-500 to-pink-500", icon: "🍷" },
];

function themeFor(title: string, cuisine: string | null) {
  // Use cuisine/category keywords to pick matching icon
  const text = `${title} ${cuisine || ""}`.toLowerCase();
  if (text.match(/salad|green|arugula|kale|spinach/)) return { gradient: "from-lime-400 via-green-500 to-emerald-600", icon: "🥗" };
  if (text.match(/fish|salmon|tuna|shrimp|seafood|cod|halibut/)) return { gradient: "from-teal-400 via-cyan-500 to-sky-600", icon: "🐟" };
  if (text.match(/chicken|poultry|turkey/)) return { gradient: "from-amber-400 via-orange-500 to-red-500", icon: "🍗" };
  if (text.match(/beef|steak|burger/)) return { gradient: "from-red-500 via-rose-600 to-pink-700", icon: "🥩" };
  if (text.match(/pasta|noodle|spaghetti|penne/)) return { gradient: "from-yellow-300 via-amber-400 to-orange-500", icon: "🍝" };
  if (text.match(/soup|stew|chowder|broth/)) return { gradient: "from-orange-400 via-red-500 to-rose-600", icon: "🍲" };
  if (text.match(/dessert|cake|cookie|pie|sweet|chocolate/)) return { gradient: "from-pink-400 via-rose-500 to-red-600", icon: "🍰" };
  if (text.match(/smoothie|juice|drink|cocktail|latte/)) return { gradient: "from-violet-400 via-purple-500 to-fuchsia-600", icon: "🥤" };
  if (text.match(/breakfast|oat|granola|pancake|waffle|egg/)) return { gradient: "from-yellow-400 via-amber-500 to-orange-600", icon: "🥞" };
  if (text.match(/pizza|flatbread/)) return { gradient: "from-red-400 via-orange-500 to-yellow-500", icon: "🍕" };
  if (text.match(/taco|burrito|mexican|fajita/)) return { gradient: "from-amber-500 via-orange-600 to-red-600", icon: "🌮" };
  if (text.match(/vegetable|vegan|vegetarian|plant/)) return { gradient: "from-emerald-400 via-teal-500 to-cyan-600", icon: "🥬" };
  if (text.match(/rice|grain|quinoa|bowl/)) return { gradient: "from-stone-400 via-amber-600 to-orange-700", icon: "🍚" };
  if (text.match(/bread|sandwich|toast|bagel/)) return { gradient: "from-amber-300 via-orange-400 to-rose-400", icon: "🥪" };

  // Fallback: hash-based
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  return PLACEHOLDER_THEMES[Math.abs(hash) % PLACEHOLDER_THEMES.length];
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
  const theme = themeFor(recipe.title, recipe.cuisine);
  const topTag = firstTag(recipe.tags, recipe.dietaryFlags);

  return (
    <div
      className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-transparent hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/recipe-id", recipe.id);
        e.dataTransfer.setData("text/plain", recipe.title);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      {/* Link layer */}
      <Link
        href={`/recipes/${recipe.id}`}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">View {recipe.title}</span>
      </Link>

      {/* Image / placeholder */}
      <div className="relative z-0 overflow-hidden">
        {recipe.imageUrl ? (
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            width={500}
            height={320}
            className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`relative h-56 w-full bg-gradient-to-br ${theme.gradient} flex items-center justify-center overflow-hidden`}>
            {/* Decorative circles */}
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10" />
            <div className="absolute -left-4 -bottom-8 h-28 w-28 rounded-full bg-white/10" />
            <div className="absolute right-12 bottom-12 h-16 w-16 rounded-full bg-white/15" />
            {/* Centered emoji icon */}
            <span
              className="relative text-7xl drop-shadow-lg group-hover:scale-110 transition-transform duration-500"
              style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}
            >
              {theme.icon}
            </span>
          </div>
        )}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none z-10">
          {recipe.cuisine ? (
            <span className="inline-flex items-center rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 shadow-sm">
              {recipe.cuisine}
            </span>
          ) : <span />}
          <div className="pointer-events-auto">
            <StarButton recipeId={recipe.id} starred={recipe.starred} size="sm" />
          </div>
        </div>

        {/* Bottom title on image */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 z-10 pointer-events-none">
          <h4 className="text-base font-bold text-white leading-tight drop-shadow-lg line-clamp-2">
            {recipe.title}
          </h4>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 pointer-events-none flex-1 p-4">
        <p className="line-clamp-2 text-sm text-slate-600 leading-relaxed">
          {recipe.description || "No summary yet."}
        </p>

        <div className="mt-3 flex items-center gap-3 text-xs">
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
      </div>
    </div>
  );
}
