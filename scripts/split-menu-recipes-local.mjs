import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, RecipeDetailStatus, RecipeSourceType } from "../src/generated/prisma/client.ts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

// Category headers that signal a new dish section
const CATEGORY_PATTERNS = [
  /^(Entrees?|Entrée)\b/i,
  /^(Salads?|Salad of the Week)\b/i,
  /^(Breakfast|Morning Nourishment)\b/i,
  /^(Snacks?|Snack or Breakfast)\b/i,
  /^(Side Dishes?|Sides?|Fruit Side)\b/i,
  /^(Desserts?|Sweet Treat)\b/i,
  /^(Drinks?|Smoothie|Juice)\b/i,
  /^(Soups?|Stews?|Soup and Salad)\b/i,
  /^(Appetizers?|Starters?)\b/i,
  /^(A Gift from Beth)\b/i,
  /^(Lunch)\b/i,
  /^(Dinner)\b/i,
];

// Personal notes to strip
const NOISE_PATTERNS = [
  /Enjoy with your .*?\./gi,
  /Enjoy!?\s*/gi,
  /I have included .*?\./gi,
  /I('ve| have) also .*?\./gi,
  /This (entree |dish )?has been double[- ]batched\.?/gi,
  /This (entree |dish )?has been tripled\.?/gi,
  /Notes?:.*$/gi,
  /\(There were no .*?\)/gi,
  /\(I have .*?\)/gi,
  /sorry!?\s*/gi,
  /yogabeth@mac\.com/gi,
  /joyfulwellnesswithbeth\.com/gi,
  /719[.\-]440[.\-]2815/gi,
  /Bon [Aa]ppetit[,!]?\s*[A-Z][a-z]+.*$/gi,
  /is included in your order[.,]?\s*/gi,
  /as well\s*$/i,
];

function cleanText(text) {
  let cleaned = text;
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  // Clean up extra whitespace and trailing punctuation artifacts
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  cleaned = cleaned.replace(/[,.\s]+$/, "").trim();
  return cleaned;
}

function detectCategory(text) {
  for (const pattern of CATEGORY_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function splitDescription(title, description) {
  if (!description || description.length < 100) {
    return [{ title, description: cleanText(description || ""), category: null }];
  }

  // Split on sentence boundaries where next sentence starts with capital
  const sentences = description.replace(/\.\s+([A-Z])/g, ".\n$1").split("\n").map(s => s.trim()).filter(Boolean);

  const dishes = [];
  let currentCategory = null;
  let currentTitle = null;
  let currentDesc = [];

  function flushDish() {
    if (currentTitle || currentDesc.length > 0) {
      const desc = cleanText(currentDesc.join(" "));
      if (currentTitle && desc) {
        dishes.push({ title: currentTitle, description: desc, category: currentCategory });
      } else if (currentTitle) {
        dishes.push({ title: currentTitle, description: "", category: currentCategory });
      } else if (desc.length > 30) {
        // Try to extract title from first part of description
        const firstSentence = desc.split(/[.!]/).filter(Boolean)[0]?.trim();
        if (firstSentence && firstSentence.length < 80) {
          dishes.push({ title: firstSentence, description: desc, category: currentCategory });
        }
      }
    }
    currentTitle = null;
    currentDesc = [];
  }

  for (const sentence of sentences) {
    // Check if this is a category header
    const cat = detectCategory(sentence);
    if (cat) {
      flushDish();
      currentCategory = cat;
      // The rest of the sentence after the category might be a dish title/description
      const remainder = sentence.slice(cat.length).trim();
      if (remainder) {
        // Could be "Entree White Fish-en-Papillote..." — the remainder is the dish
        currentDesc.push(remainder);
      }
      continue;
    }

    // Heuristic: if a sentence starts with a capitalized multi-word phrase
    // that looks like a dish name (contains food words or is title-case),
    // treat it as a new dish
    const looksLikeTitle = (
      sentence.length > 20 &&
      /^[A-Z][a-z]/.test(sentence) &&
      currentDesc.length > 0 &&
      currentDesc.join(" ").length > 50
    );

    if (looksLikeTitle) {
      flushDish();
    }

    currentDesc.push(sentence);
  }

  flushDish();

  // If we only extracted one dish and the original was long, just clean it
  if (dishes.length <= 1 && description.length > 200) {
    return [{ title, description: cleanText(description), category: null }];
  }

  // If no dishes were extracted, return the original cleaned
  if (dishes.length === 0) {
    return [{ title, description: cleanText(description), category: null }];
  }

  return dishes;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const candidates = await prisma.recipe.findMany({
    where: {
      sourceType: RecipeSourceType.IMPORTED,
      detailStatus: RecipeDetailStatus.STARTER,
      NOT: { description: null },
    },
    orderBy: { title: "asc" },
  });

  const toSplit = candidates.filter(r => r.description && r.description.length > 200);
  const toClean = candidates.filter(r => r.description && r.description.length <= 200);

  console.log(`${toSplit.length} multi-recipe records to split`);
  console.log(`${toClean.length} short records to clean`);

  let totalCreated = 0;
  let totalDeleted = 0;
  let totalCleaned = 0;

  // Clean short descriptions (just remove noise)
  for (const recipe of toClean) {
    const cleaned = cleanText(recipe.description);
    if (cleaned !== recipe.description) {
      if (!dryRun) {
        await prisma.recipe.update({
          where: { id: recipe.id },
          data: { description: cleaned, sourceDescription: cleaned },
        });
      }
      totalCleaned++;
    }
  }

  // Split long descriptions
  for (let i = 0; i < toSplit.length; i++) {
    const recipe = toSplit[i];
    const dishes = splitDescription(recipe.title, recipe.description);

    if (dishes.length <= 1) {
      // Just clean the single record
      const cleaned = cleanText(recipe.description);
      if (cleaned !== recipe.description && !dryRun) {
        await prisma.recipe.update({
          where: { id: recipe.id },
          data: { description: cleaned, sourceDescription: cleaned },
        });
        totalCleaned++;
      }
      continue;
    }

    if (dryRun) {
      console.log(`\n[${i + 1}] ${recipe.title} → ${dishes.length} dishes`);
      for (const d of dishes) {
        console.log(`  [${d.category || "-"}] ${d.title.slice(0, 60)}`);
      }
      continue;
    }

    // Create individual recipes
    for (const dish of dishes) {
      if (!dish.title || dish.title.length < 3) continue;
      await prisma.recipe.create({
        data: {
          kitchenId: recipe.kitchenId,
          title: dish.title,
          description: dish.description || null,
          sourceDescription: dish.description || null,
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

  console.log(`\n=== Done ===`);
  console.log(`Split into: ${totalCreated} new recipes`);
  console.log(`Deleted originals: ${totalDeleted}`);
  console.log(`Cleaned in place: ${totalCleaned}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
