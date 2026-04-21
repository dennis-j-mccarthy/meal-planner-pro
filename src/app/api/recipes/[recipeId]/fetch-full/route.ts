import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { prisma } from "@/lib/prisma";

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

  let ingredientsText: string | null = null;
  let instructionsText: string | null = null;
  let imageUrl: string | null = null;
  let description: string | null = null;
  let prepMinutes: number | null = null;
  let cookMinutes: number | null = null;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      );
      await page.goto(sourceUrl, { waitUntil: "networkidle2", timeout: 15000 });

      const extracted = await page.evaluate(() => {
        const scripts = document.querySelectorAll(
          'script[type="application/ld+json"]',
        );
        for (const script of scripts) {
          try {
            const parsed = JSON.parse(script.textContent || "");
            const find = (
              obj: Record<string, unknown>,
            ): Record<string, unknown> | null => {
              if (obj["@type"] === "Recipe") return obj;
              if (Array.isArray(obj)) {
                for (const item of obj) {
                  const found = find(item);
                  if (found) return found;
                }
              }
              if (obj["@graph"] && Array.isArray(obj["@graph"])) {
                for (const item of obj["@graph"]) {
                  const found = find(item);
                  if (found) return found;
                }
              }
              return null;
            };
            const recipe = find(parsed);
            if (recipe) return recipe;
          } catch {
            /* skip */
          }
        }
        return null;
      });

      if (extracted) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = extracted as any;

        if (r.description) description = r.description;

        if (r.image) {
          const img = r.image;
          if (typeof img === "string") imageUrl = img;
          else if (Array.isArray(img))
            imageUrl = typeof img[0] === "string" ? img[0] : img[0]?.url;
          else if (img?.url) imageUrl = img.url;
        }

        if (Array.isArray(r.recipeIngredient)) {
          ingredientsText = r.recipeIngredient.join("\n");
        }

        if (Array.isArray(r.recipeInstructions)) {
          instructionsText = r.recipeInstructions
            .map(
              (
                step: string | { text?: string },
                i: number,
              ) => {
                const text =
                  typeof step === "string" ? step : step?.text || "";
                return `${i + 1}. ${text.trim()}`;
              },
            )
            .filter((s: string) => s.length > 3)
            .join("\n");
        }

        function parseDuration(dur: string | undefined): number | null {
          if (!dur || typeof dur !== "string") return null;
          const h = dur.match(/(\d+)H/i);
          const m = dur.match(/(\d+)M/i);
          const total =
            (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
          return total > 0 ? total : null;
        }
        prepMinutes = parseDuration(r.prepTime);
        cookMinutes = parseDuration(r.cookTime);
      }
    } finally {
      await browser.close();
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch recipe" },
      { status: 500 },
    );
  }

  // Only update fields that we actually found
  const updateData: Record<string, unknown> = {};
  if (ingredientsText && (!recipe.ingredientsText || recipe.ingredientsText.split("\n").length < 3)) {
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
