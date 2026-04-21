import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, RecipeDetailStatus, RecipeSourceType } from "../src/generated/prisma/client.ts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });
const anthropic = new Anthropic();

async function splitWithClaude(title, description) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are parsing a personal chef's menu card into individual recipe entries.

This text is a single menu card that contains multiple dishes mashed together. Split it into separate recipes.

Menu title: ${title}
Menu text:
${description}

Rules:
- Extract each distinct dish as its own entry with a clear title and description
- Remove ALL personal notes: "Enjoy with...", "I have included...", "This has been double batched", "Notes:", apologies, "is included in your order", references to "your" anything
- Remove email addresses, phone numbers, URLs, "Bon Appetit" signoffs, "To your health and happiness", "Chef Beth"
- Keep the actual food content — ingredients, preparation methods, flavors, what makes the dish special
- If a category exists (Entree, Salad, Breakfast, Snack, Side, Dessert, Drink, Appetizer), include it
- Give each dish a proper capitalized title — not a sentence fragment

Return ONLY a JSON array:
[{"title": "Dish Name", "description": "Clean description", "category": "Entree"}]`
      }
    ],
  });

  const text = response.content[0].text;
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in response");
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limit = parseInt(process.argv.find(a => a.startsWith("--limit="))?.split("=")[1] || "999");

  const candidates = await prisma.recipe.findMany({
    where: {
      sourceType: RecipeSourceType.IMPORTED,
      detailStatus: RecipeDetailStatus.STARTER,
      NOT: { description: null },
    },
    orderBy: { title: "asc" },
    take: limit,
  });

  const toSplit = candidates.filter(r => r.description && r.description.length > 200);
  console.log(`Found ${toSplit.length} recipes to split (limit: ${limit}, dry-run: ${dryRun})\n`);

  let totalCreated = 0;
  let totalDeleted = 0;
  let errors = 0;

  for (let i = 0; i < toSplit.length; i++) {
    const recipe = toSplit[i];
    process.stdout.write(`[${i + 1}/${toSplit.length}] ${recipe.title.slice(0, 50)}... `);

    try {
      const dishes = await splitWithClaude(recipe.title, recipe.description);

      if (!Array.isArray(dishes) || dishes.length === 0) {
        console.log("⚠ no dishes");
        continue;
      }

      console.log(`→ ${dishes.length} dishes`);

      if (dryRun) {
        for (const d of dishes) {
          console.log(`    [${d.category || "-"}] ${d.title}`);
        }
      } else {
        for (const dish of dishes) {
          if (!dish.title || dish.title.trim().length < 3) continue;
          await prisma.recipe.create({
            data: {
              kitchenId: recipe.kitchenId,
              title: dish.title.trim(),
              description: dish.description?.trim() || null,
              sourceDescription: dish.description?.trim() || null,
              sourceType: RecipeSourceType.IMPORTED,
              detailStatus: RecipeDetailStatus.STARTER,
              sourceName: `Split from: ${recipe.title}`,
              tags: dish.category || null,
              notes: recipe.notes,
            },
          });
          totalCreated++;
        }

        await prisma.recipe.delete({ where: { id: recipe.id } });
        totalDeleted++;
      }

      // Small delay to avoid rate limits
      if (i < toSplit.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (err) {
      console.log(`✗ ${err.message.slice(0, 80)}`);
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
