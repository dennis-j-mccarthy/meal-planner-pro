import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const NOISE_PATTERNS = [
  /Enjoy with your .*?\./gi,
  /Enjoy!\s*/gi,
  /I have included .*?\./gi,
  /I('ve| have) also included .*?\./gi,
  /This (entree |dish )?has been double[- ]batched\.?\s*/gi,
  /This (entree |dish )?has been tripled\.?\s*/gi,
  /Notes?:\s*.*$/gim,
  /\(There were no .*?\)\s*/gi,
  /\(I have .*?\)\s*/gi,
  /\(sorry[^)]*\)\s*/gi,
  /sorry!?\s*/gi,
  /yogabeth@mac\.com\s*/gi,
  /joyfulwellnesswithbeth\.com\s*/gi,
  /719[.\-]440[.\-]2815\s*/gi,
  /Bon [Aa]ppetit[,!]?\s*[A-Z][a-z]+.*$/gim,
  /is included in your order[.,]?\s*/gi,
  /are included in your order[.,]?\s*/gi,
  /\bis included\b[.,]?\s*/gi,
  /as well\s*$/im,
  /To your health and happiness\.{0,3}\s*/gi,
  /Chef Beth\s*/gi,
  /Beth McCarthy\s*/gi,
];

function cleanText(text) {
  if (!text) return text;
  let cleaned = text;
  for (const pattern of NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, " ");
  }
  // Clean up whitespace
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  // Remove trailing/leading punctuation artifacts
  cleaned = cleaned.replace(/^[,.\s]+/, "").replace(/[,\s]+$/, "").trim();
  return cleaned;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const recipes = await prisma.recipe.findMany({
    where: { NOT: { description: null } },
  });

  let changed = 0;

  for (const recipe of recipes) {
    const cleaned = cleanText(recipe.description);
    const cleanedSource = cleanText(recipe.sourceDescription);

    if (cleaned !== recipe.description || cleanedSource !== recipe.sourceDescription) {
      if (dryRun) {
        if (cleaned !== recipe.description) {
          console.log(`\n--- ${recipe.title} ---`);
          console.log(`BEFORE: ${recipe.description?.slice(0, 100)}...`);
          console.log(`AFTER:  ${cleaned?.slice(0, 100)}...`);
        }
      } else {
        await prisma.recipe.update({
          where: { id: recipe.id },
          data: {
            description: cleaned || null,
            sourceDescription: cleanedSource || null,
          },
        });
      }
      changed++;
    }
  }

  console.log(`\n${changed} recipes ${dryRun ? "would be" : ""} cleaned out of ${recipes.length} total`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
