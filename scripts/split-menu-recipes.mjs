import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, RecipeDetailStatus, RecipeSourceType } from "../src/generated/prisma/client.ts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });
const API_KEY = process.env.GEMINI_API_KEY;

async function splitWithGemini(title, description) {
  const prompt = `You are parsing a personal chef's menu description into individual recipe entries.

The following text is a single menu card that contains multiple dishes. Split it into separate recipes.

Menu title: ${title}
Menu text:
${description}

Rules:
- Extract each distinct dish as a separate recipe
- For each recipe, provide a clear title and a clean description
- Remove personal notes like "Enjoy with your dinner salad", "I have included...", "This has been double batched", "Notes:", apologies, references to "your order", etc.
- Remove email addresses, phone numbers, website URLs
- Remove "Bon Appetit" signoffs
- Keep the actual food descriptions — ingredients, preparation methods, flavors
- If a category header exists (like "Salad", "Entree", "Breakfast", "Side", "Snack"), include it as the category
- If a dish has no real description beyond the title, still include it with an empty description

Return ONLY valid JSON array:
[
  {
    "title": "Dish Name",
    "description": "Clean description of the dish",
    "category": "Entree" or "Salad" or "Breakfast" or "Side" or "Snack" or "Dessert" or "Drink" or null
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  return JSON.parse(text);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = parseInt(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] || "999");

  // Find multi-recipe records (long descriptions from imports)
  const candidates = await prisma.recipe.findMany({
    where: {
      sourceType: RecipeSourceType.IMPORTED,
      detailStatus: RecipeDetailStatus.STARTER,
    },
    orderBy: { title: "asc" },
    take: limit,
  });

  // Filter to those with long descriptions likely containing multiple recipes
  const toSplit = candidates.filter(r => r.description && r.description.length > 200);

  console.log(`Found ${toSplit.length} recipes to split (limit: ${limit}, dry-run: ${dryRun})`);

  let totalCreated = 0;
  let totalDeleted = 0;
  let errors = 0;

  for (let i = 0; i < toSplit.length; i++) {
    const recipe = toSplit[i];
    console.log(`\n[${i + 1}/${toSplit.length}] ${recipe.title}`);
    console.log(`  Description length: ${recipe.description.length} chars`);

    try {
      const dishes = await splitWithGemini(recipe.title, recipe.description);

      if (!Array.isArray(dishes) || dishes.length === 0) {
        console.log("  ⚠ No dishes extracted, skipping");
        continue;
      }

      console.log(`  → ${dishes.length} dishes extracted`);

      if (dryRun) {
        for (const dish of dishes) {
          console.log(`    - [${dish.category || "?"}] ${dish.title}`);
        }
        continue;
      }

      // Create individual recipes
      for (const dish of dishes) {
        if (!dish.title || dish.title.trim().length === 0) continue;

        await prisma.recipe.create({
          data: {
            kitchenId: recipe.kitchenId,
            title: dish.title.trim(),
            description: dish.description?.trim() || null,
            sourceDescription: dish.description?.trim() || null,
            sourceType: RecipeSourceType.IMPORTED,
            detailStatus: RecipeDetailStatus.STARTER,
            sourceName: `Split from: ${recipe.title}`,
            sourceExternalId: `split:${recipe.id}:${dish.title.slice(0, 50)}`,
            tags: dish.category || null,
            notes: recipe.notes,
          },
        });
        totalCreated++;
      }

      // Delete the original multi-recipe record
      await prisma.recipe.delete({ where: { id: recipe.id } });
      totalDeleted++;

      // Rate limit — Gemini free tier
      if (i < toSplit.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Created: ${totalCreated}`);
  console.log(`Deleted originals: ${totalDeleted}`);
  console.log(`Errors: ${errors}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
