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


export function RecipeCard({ recipe }: RecipeCardProps) {

  return (
    <div
      className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-md cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/recipe-id", recipe.id);
        e.dataTransfer.setData("text/plain", recipe.title);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      {/* Clickable link layer */}
      <Link
        href={`/recipes/${recipe.id}`}
        className="absolute inset-0 z-0 rounded-xl"
      >
        <span className="sr-only">View {recipe.title}</span>
      </Link>

      {/* Image */}
      {recipe.imageUrl && (
        <div className="relative z-0 -mx-5 -mt-5 mb-3 overflow-hidden rounded-t-xl">
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            width={400}
            height={200}
            className="h-56 w-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 pointer-events-none flex-1">
        <div className="flex items-start justify-between gap-2">
          {recipe.cuisine && (
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {recipe.cuisine}
            </p>
          )}
          <div className="pointer-events-auto">
            <StarButton recipeId={recipe.id} starred={recipe.starred} size="sm" />
          </div>
        </div>
        <h4 className="mt-1.5 text-base font-semibold text-slate-900 group-hover:text-[var(--accent-strong)]">
          {recipe.title}
        </h4>
        <p className="mt-2 line-clamp-3 text-sm text-slate-600 leading-relaxed">
          {recipe.description || "No recipe summary yet."}
        </p>

        {(recipe.timingLabel !== "Timing not set" || recipe.servings) && (
          <p className="mt-2 text-xs text-slate-500">
            {recipe.timingLabel !== "Timing not set" ? recipe.timingLabel : ""}
            {recipe.timingLabel !== "Timing not set" && recipe.servings ? " · " : ""}
            {recipe.servings ? `serves ${recipe.servings}` : ""}
          </p>
        )}
      </div>



    </div>
  );
}
