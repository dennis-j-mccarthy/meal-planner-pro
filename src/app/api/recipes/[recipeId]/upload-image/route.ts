import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { unlink } from "fs/promises";
import { join } from "path";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

// Vercel serverless functions cap body size at ~4.5MB and have a read-only
// filesystem, so recipe photos are stored in Vercel Blob (same store the
// newsletter images use) rather than written to public/.
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;

  // Kitchen-scoped: only authenticated users (or demo mode) can upload, and
  // only to recipes in their own kitchen.
  const kitchen = await getKitchen();
  if (!kitchen) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, kitchenId: kitchen.id },
  });
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const originalName =
    file instanceof File && file.name ? file.name : "image.jpg";
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `recipes/${kitchen.id}/${recipeId}-${safeName}`;

  const blob = await put(key, file, {
    access: "public",
    contentType: file.type || "image/jpeg",
    addRandomSuffix: true,
  });

  // Best-effort cleanup of the previously stored blob image.
  if (recipe.imageUrl?.includes("blob.vercel-storage.com")) {
    try { await del(recipe.imageUrl); } catch { /* already gone */ }
  }

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { imageUrl: blob.url },
  });

  return NextResponse.json({ imageUrl: blob.url });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;

  const kitchen = await getKitchen();
  if (!kitchen) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, kitchenId: kitchen.id },
  });
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  if (recipe.imageUrl?.includes("blob.vercel-storage.com")) {
    try { await del(recipe.imageUrl); } catch { /* already gone */ }
  } else if (recipe.imageUrl?.startsWith("/recipe-images/")) {
    // Legacy local file (pre-Blob uploads).
    try { await unlink(join(process.cwd(), "public", recipe.imageUrl)); } catch { /* may not exist */ }
  }

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { imageUrl: null },
  });

  return NextResponse.json({ ok: true });
}
