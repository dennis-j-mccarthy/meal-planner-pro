import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;
  const formData = await request.formData();
  const file = formData.get("image") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // Save to public/recipe-images/
  const dir = join(process.cwd(), "public", "recipe-images");
  await mkdir(dir, { recursive: true });

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${recipeId}.${ext}`;
  const filepath = join(dir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buffer);

  const imageUrl = `/recipe-images/${filename}`;

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { imageUrl },
  });

  return NextResponse.json({ imageUrl });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ recipeId: string }> },
) {
  const { recipeId } = await params;

  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  // Delete local file if it's a local path
  if (recipe.imageUrl?.startsWith("/recipe-images/")) {
    const filepath = join(process.cwd(), "public", recipe.imageUrl);
    try { await unlink(filepath); } catch { /* file may not exist */ }
  }

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { imageUrl: null },
  });

  return NextResponse.json({ ok: true });
}
