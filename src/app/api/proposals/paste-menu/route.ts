import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { RecipeSourceType, RecipeDetailStatus } from "@/generated/prisma/client";

const anthropic = new Anthropic();

async function parseWithClaude(text: string) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Parse this personal chef menu into structured recipes.

Text:
${text}

Rules:
- Identify category headers on their own line (e.g. "Entrees", "Nourishing Breakfast", "A Gift from Beth")
- Extract each dish as a separate recipe with clean title and description
- Strip personal notes: "Enjoy with...", "Note:", "I have included...", email/phone/URLs, "Bon Appetit [name]!" signoffs
- Keep the actual food content — ingredients, preparation, what makes the dish special
- Clean category names (e.g. "Nourishing Breakfast" → "Breakfast", "Entrees" stays, "A Gift from Beth" stays)

Return ONLY a JSON array:
[{"title": "Dish Name", "description": "Clean description", "category": "Entrees"}]`,
      },
    ],
  });

  const responseText = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array in response");
  return JSON.parse(jsonMatch[0]) as Array<{
    title: string;
    description: string;
    category: string;
  }>;
}

export async function POST(request: NextRequest) {
  const { proposalId, text } = await request.json();

  if (!proposalId || !text) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  let dishes;
  try {
    dishes = await parseWithClaude(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Current max position in the proposal
  const maxPos = await prisma.proposalRecipe.aggregate({
    where: { proposalId },
    _max: { position: true },
  });
  let nextPos = (maxPos._max.position ?? 0) + 1;

  let created = 0;
  for (const dish of dishes) {
    if (!dish.title || dish.title.trim().length < 3) continue;

    // Create the recipe in the library
    const recipe = await prisma.recipe.create({
      data: {
        kitchenId: proposal.kitchenId,
        title: dish.title.trim(),
        description: dish.description?.trim() || null,
        sourceDescription: dish.description?.trim() || null,
        sourceType: RecipeSourceType.MANUAL,
        detailStatus: RecipeDetailStatus.READY,
        tags: dish.category || null,
      },
    });

    // Add it to the proposal
    await prisma.proposalRecipe.create({
      data: {
        proposalId,
        recipeId: recipe.id,
        position: nextPos++,
        courseLabel: dish.category || null,
      },
    });
    created++;
  }

  return NextResponse.json({ created });
}
