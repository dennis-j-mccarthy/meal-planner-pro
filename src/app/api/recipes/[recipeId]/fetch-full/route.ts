import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeRecipeFromUrl, parseDuration, extractImageUrl } from "@/lib/recipe-scraper";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;
  const { sourceUrl } = await request.json();

  if (!sourceUrl) {
    return NextResponse.json({ error: "No source URL" }, { status: 400 });
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
  });

  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const r = await scrapeRecipeFromUrl(sourceUrl);
  if (!r) {
    return NextResponse.json(
      { error: "Failed to fetch recipe" },
      { status: 500 },
    );
  }

  let ingredientsText: string | null = null;
  let instructionsText: string | null = null;
  const imageUrl = extractImageUrl(r.image);
  const description = r.description || null;
  const prepMinutes = parseDuration(r.prepTime);
  const cookMinutes = parseDuration(r.cookTime);

  if (Array.isArray(r.recipeIngredient)) {
    ingredientsText = r.recipeIngredient.join("\n");
  }

  if (Array.isArray(r.recipeInstructions)) {
    instructionsText = r.recipeInstructions
      .map((step: string | { text?: string }, i: number) => {
        const text = typeof step === "string" ? step : step?.text || "";
        return `${i + 1}. ${text.trim()}`;
      })
      .filter((s: string) => s.length > 3)
      .join("\n");
  }

  // Only update fields that we actually found and that are missing/sparse
  const updateData: Record<string, unknown> = {};
  if (
    ingredientsText &&
    (!recipe.ingredientsText || recipe.ingredientsText.split("\n").length < 3)
  ) {
    updateData.ingredientsText = ingredientsText;
  }
  if (instructionsText && !recipe.instructionsText) {
    updateData.instructionsText = instructionsText;
  }
  if (imageUrl && !recipe.imageUrl) {
    updateData.imageUrl = imageUrl;
  }
  if (description && !recipe.description) {
    updateData.description = description;
  }
  if (prepMinutes && !recipe.prepMinutes) {
    updateData.prepMinutes = prepMinutes;
  }
  if (cookMinutes && !recipe.cookMinutes) {
    updateData.cookMinutes = cookMinutes;
  }

  if (Object.keys(updateData).length > 0) {
    updateData.detailStatus = "READY";
    await prisma.recipe.update({
      where: { id: recipeId },
      data: updateData,
    });
  }

  return NextResponse.json({ updated: Object.keys(updateData) });
}
