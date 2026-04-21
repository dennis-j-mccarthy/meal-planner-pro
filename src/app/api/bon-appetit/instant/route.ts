import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getKitchen } from "@/lib/data";
import { RecipeSourceType, RecipeDetailStatus, ProposalStatus } from "@/generated/prisma/client";

// Known category headers
const CATEGORY_PATTERNS = [
  "Entrees and Sides",
  "Entrees",
  "Morning Nourishment",
  "Breakfast",
  "Salad",
  "Salads",
  "Soups",
  "Soup",
  "Side Dishes",
  "Sides",
  "Snacks",
  "Snack",
  "Desserts",
  "Dessert",
  "Drinks",
  "Smoothies",
  "Healthy Juice",
  "A Gift from Beth",
  "Appetizers",
];

interface ParsedRecipe {
  title: string;
  description: string;
  category: string;
}

function parseMenuText(text: string): ParsedRecipe[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const recipes: ParsedRecipe[] = [];
  let currentCategory = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if line is a category header
    const isCat = CATEGORY_PATTERNS.some(
      (p) => line.toLowerCase() === p.toLowerCase(),
    );

    if (isCat) {
      currentCategory = line;
      i++;
      continue;
    }

    // This line is a recipe title. Collect description lines after it.
    const title = line;
    const descLines: string[] = [];
    i++;

    while (
      i < lines.length &&
      !CATEGORY_PATTERNS.some((p) => lines[i].toLowerCase() === p.toLowerCase())
    ) {
      const nextLine = lines[i];

      // If the next line looks like a new recipe title (short, capitalized,
      // no period at start, and we already have description), break
      if (
        descLines.length > 0 &&
        nextLine.length > 10 &&
        /^[A-Z]/.test(nextLine) &&
        !nextLine.startsWith("This ") &&
        !nextLine.startsWith("A ") &&
        !nextLine.startsWith("An ") &&
        !nextLine.startsWith("The ") &&
        !nextLine.startsWith("Served ") &&
        !nextLine.startsWith("Enjoy ") &&
        !nextLine.startsWith("Made ") &&
        !nextLine.startsWith("Paired ") &&
        !nextLine.startsWith("Golden") &&
        !nextLine.startsWith("Fresh") &&
        !nextLine.startsWith("Tender") &&
        !nextLine.startsWith("Topped") &&
        !nextLine.startsWith("Drizzled") &&
        // If previous description is substantial, this is likely a new recipe
        descLines.join(" ").length > 80
      ) {
        break;
      }

      descLines.push(nextLine);
      i++;
    }

    if (title.length > 3) {
      recipes.push({
        title,
        description: descLines.join(" ").trim(),
        category: currentCategory,
      });
    }
  }

  return recipes;
}

export async function POST(request: NextRequest) {
  const { clientId, date, text } = await request.json();

  if (!clientId || !date || !text) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const kitchen = await getKitchen();

  const client = await prisma.client.findFirst({
    where: { id: clientId, kitchenId: kitchen.id },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const parsed = parseMenuText(text);
  if (parsed.length === 0) {
    return NextResponse.json({ error: "No recipes parsed" }, { status: 400 });
  }

  // Create recipes
  const recipeRecords: { id: string; position: number; category: string }[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const r = parsed[i];
    const recipe = await prisma.recipe.create({
      data: {
        kitchenId: kitchen.id,
        title: r.title,
        description: r.description || null,
        sourceDescription: r.description || null,
        sourceType: RecipeSourceType.MANUAL,
        detailStatus: RecipeDetailStatus.DRAFT,
        tags: r.category || null,
      },
    });
    recipeRecords.push({ id: recipe.id, position: i + 1, category: r.category });
  }

  // Create cook date
  const cookDate = await prisma.cookDate.create({
    data: {
      kitchenId: kitchen.id,
      clientId,
      scheduledFor: new Date(`${date}T12:00:00`),
      status: "APPROVED",
    },
  });

  // Create approved proposal
  const proposal = await prisma.proposal.create({
    data: {
      kitchenId: kitchen.id,
      cookDateId: cookDate.id,
      title: `Menu for ${client.firstName} ${client.lastName}`,
      status: ProposalStatus.APPROVED,
      approvedAt: new Date(),
      sentAt: new Date(),
      recipes: {
        create: recipeRecords.map((r) => ({
          recipeId: r.id,
          position: r.position,
          courseLabel: r.category || null,
        })),
      },
    },
  });

  // Finalize cook date
  await prisma.cookDate.update({
    where: { id: cookDate.id },
    data: { finalizedProposalId: proposal.id },
  });

  // Create bon appetit
  const bonAppetit = await prisma.menuCard.create({
    data: {
      kitchenId: kitchen.id,
      clientId,
      cookDateId: cookDate.id,
      title: `Bon Appetit, ${client.firstName}!`,
      menuDate: new Date(`${date}T12:00:00`),
      accepted: true,
      recipes: {
        create: recipeRecords.map((r) => ({
          recipeId: r.id,
          position: r.position,
          category: r.category || null,
        })),
      },
    },
  });

  return NextResponse.json({
    bonAppetitId: bonAppetit.id,
    bonAppetitUrl: `/menu-cards/${bonAppetit.id}`,
    recipesCreated: parsed.length,
  });
}
