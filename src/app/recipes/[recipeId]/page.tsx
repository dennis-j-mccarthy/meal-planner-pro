import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { DeleteRecipeButton } from "@/components/delete-recipe-button";
import { FetchFullRecipeButton } from "@/components/fetch-full-recipe-button";
import { GenerateImageButton } from "@/components/generate-image-button";
import { UploadRecipeImage } from "@/components/upload-recipe-image";
import { RegenerateTextButton } from "@/components/regenerate-text-button";
import { StarButton } from "@/components/star-button";
import {
  formatEnum,
  formatMinutes,
} from "@/lib/format";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type RecipeDetailPageProps = {
  params: Promise<{
    recipeId: string;
  }>;
};

function formatDescription(text: string): string[] {
  // Split on sentence-ending patterns that signal a new recipe/section
  // e.g. "...dessert. Sloppy Joe..." or "...sandwiches. Paprika spiced..."
  return text
    .replace(/\.\s+([A-Z])/g, ".\n$1")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toList(value?: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((item) => item.replace(/^[-\d.\s]+/, "").trim())
    .filter(Boolean);
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { recipeId } = await params;
  const kitchen = await getKitchen();

  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      kitchenId: kitchen.id,
    },
  });

  if (!recipe) {
    notFound();
  }

  const ingredients = toList(recipe.ingredientsText);
  const instructions = toList(recipe.instructionsText);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          className="text-sm font-medium text-slate-500 hover:text-slate-700"
          href="/recipes"
        >
          &larr; Back to recipes
        </Link>
      </div>

      <section className="panel p-6 sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={formatEnum(recipe.detailStatus)} />
              <StatusBadge label={formatEnum(recipe.sourceType)} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {recipe.title}
              </h1>
              <StarButton recipeId={recipe.id} starred={recipe.starred} />
            </div>
            {recipe.description ? (
              <div className="mt-3 max-w-2xl space-y-2">
                {formatDescription(recipe.description).map((para, i) => (
                  <p key={i} className="text-base text-slate-600 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-base text-slate-500">
                No recipe summary has been added yet.
              </p>
            )}
            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <UploadRecipeImage recipeId={recipe.id} hasImage={!!recipe.imageUrl} />
              <GenerateImageButton recipeId={recipe.id} hasImage={!!recipe.imageUrl} />
              <RegenerateTextButton recipeId={recipe.id} />
              {recipe.sourceUrl && (!recipe.instructionsText || (recipe.ingredientsText && recipe.ingredientsText.split("\n").length < 3)) && (
                <FetchFullRecipeButton recipeId={recipe.id} sourceUrl={recipe.sourceUrl} />
              )}
            </div>
          </div>

          {recipe.imageUrl ? (
            <div className="shrink-0 overflow-hidden rounded-xl xl:w-[40%]">
              <Image
                src={recipe.imageUrl}
                alt={recipe.title}
                width={600}
                height={600}
                className="aspect-square w-full object-cover"
              />
            </div>
          ) : null}
        </div>
      </section>

      {/* Ingredients — only if present */}
      {ingredients.length > 0 && (
        <section className="panel p-6">
          <h2 className="text-lg font-bold text-slate-900">Ingredients</h2>
          <ul className="mt-3 columns-2 gap-x-6 text-sm text-slate-700">
            {ingredients.map((ingredient, index) => (
              <li
                key={`${ingredient}-${index}`}
                className="flex items-baseline gap-2 py-1"
              >
                <span className="h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {ingredient}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Method — only if present */}
      {instructions.length > 0 && (
        <section className="panel p-6">
          <h2 className="text-lg font-bold text-slate-900">Method</h2>
          <ol className="mt-3 space-y-2">
            {instructions.map((step, index) => (
              <li
                key={`${step}-${index}`}
                className="flex items-start gap-3 text-sm text-slate-700"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-px">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* No content prompt */}
      {ingredients.length === 0 && instructions.length === 0 && (
        <section className="panel p-6 text-center">
          <p className="text-sm text-slate-400 mb-3">
            This recipe doesn&apos;t have ingredients or instructions yet.
          </p>
          <div className="flex justify-center gap-3">
            <RegenerateTextButton recipeId={recipe.id} />
            {recipe.sourceUrl && (
              <FetchFullRecipeButton recipeId={recipe.id} sourceUrl={recipe.sourceUrl} />
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <section className="border-t border-slate-200 pt-6 flex items-center justify-between">
        <DeleteRecipeButton recipeId={recipe.id} />
        {(recipe.sourceName || recipe.sourceUrl) && (
          <p className="text-xs text-slate-400">
            Source: {recipe.sourceUrl ? (
              <a
                className="text-[var(--accent-strong)] hover:underline"
                href={recipe.sourceUrl}
                rel="noreferrer"
                target="_blank"
              >
                {recipe.sourceName || recipe.sourceUrl}
              </a>
            ) : recipe.sourceName}
          </p>
        )}
      </section>
    </div>
  );
}
