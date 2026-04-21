import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  PrismaClient,
  RecipeDetailStatus,
  RecipeSourceType,
} from "../src/generated/prisma/client.ts";
import { createRecipeDraft } from "../src/lib/recipe-draft.ts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const kitchen = await prisma.kitchen.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!kitchen) {
    throw new Error("No kitchen found.");
  }

  const recipes = await prisma.recipe.findMany({
    where: {
      kitchenId: kitchen.id,
      sourceType: RecipeSourceType.IMPORTED,
    },
    select: {
      id: true,
      title: true,
      description: true,
      sourceDescription: true,
      detailStatus: true,
    },
  });

  let converted = 0;

  for (const recipe of recipes) {
    const rawSource = recipe.sourceDescription || recipe.description || recipe.title;
    const draft = createRecipeDraft(recipe.title, rawSource);

    await prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        description: draft.summary,
        sourceDescription: rawSource,
        ingredientsText: draft.ingredientsText,
        instructionsText: draft.instructionsText,
        detailStatus:
          recipe.detailStatus === RecipeDetailStatus.READY
            ? RecipeDetailStatus.READY
            : RecipeDetailStatus.DRAFT,
      },
    });

    converted += 1;
  }

  console.log(
    JSON.stringify(
      {
        converted,
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
