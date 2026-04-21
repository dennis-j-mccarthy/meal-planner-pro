import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import {
  deriveAttributeTagsFromTitle,
  mergeTagValues,
} from "../src/lib/recipe-tags.ts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      tags: true,
    },
  });

  let updated = 0;

  for (const recipe of recipes) {
    const mergedTags = mergeTagValues(
      recipe.tags,
      deriveAttributeTagsFromTitle(recipe.title),
    );

    if (mergedTags !== recipe.tags) {
      await prisma.recipe.update({
        where: { id: recipe.id },
        data: {
          tags: mergedTags,
        },
      });
      updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        total: recipes.length,
        updated,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
