import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  PrismaClient,
  RecipeDetailStatus,
  RecipeSourceType,
} from "../src/generated/prisma/client.ts";
import {
  deriveAttributeTagsFromTitle,
  mergeTagValues,
} from "../src/lib/recipe-tags.ts";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});

const prisma = new PrismaClient({ adapter });

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTitle(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return null;
  }

  return normalized.replace(/^,\s*/, "");
}

function buildNotes(record) {
  const parts = [
    record.client ? `Original client: ${record.client}` : null,
    record.date ? `Original date: ${record.date}` : null,
    Array.isArray(record.all_clients) && record.all_clients.length > 0
      ? `All clients: ${record.all_clients.join(", ")}`
      : null,
    record.duplicate_count ? `Duplicate count: ${record.duplicate_count}` : null,
    record.source_file ? `Source file: ${record.source_file}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("\n") : null;
}

async function getKitchenId() {
  const existingKitchen = await prisma.kitchen.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existingKitchen) {
    return existingKitchen.id;
  }

  const kitchen = await prisma.kitchen.create({
    data: {
      name: "Founder's Table",
      city: "Charlotte",
      state: "NC",
      serviceArea: "Nationwide private chef planning",
      notes: "Default kitchen workspace for recipe starter imports.",
    },
    select: { id: true },
  });

  return kitchen.id;
}

async function main() {
  const inputPath = process.argv[2] || process.env.RECIPE_STARTERS_FILE;

  if (!inputPath) {
    throw new Error("Provide a JSON file path as the first argument or set RECIPE_STARTERS_FILE.");
  }

  const resolvedPath = path.resolve(inputPath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Recipe starters file must contain a top-level array.");
  }

  const kitchenId = await getKitchenId();
  const sourceIds = parsed
    .map((record) => record?.id)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => `starter-json:${String(value)}`);

  const existingRecipes = await prisma.recipe.findMany({
    where: {
      kitchenId,
      sourceType: RecipeSourceType.IMPORTED,
      sourceExternalId: {
        in: sourceIds,
      },
    },
    select: {
      sourceExternalId: true,
    },
  });

  const existingIds = new Set(
    existingRecipes
      .map((recipe) => recipe.sourceExternalId)
      .filter(Boolean),
  );

  let created = 0;
  let skipped = 0;
  let invalid = 0;

  const recordsToCreate = [];

  for (const record of parsed) {
    const title = normalizeTitle(record?.title);
    const sourceExternalId =
      record?.id !== null && record?.id !== undefined
        ? `starter-json:${String(record.id)}`
        : null;

    if (!title || !sourceExternalId) {
      invalid += 1;
      continue;
    }

    if (existingIds.has(sourceExternalId)) {
      skipped += 1;
      continue;
    }

    const categories = Array.isArray(record.categories)
      ? [...new Set(record.categories.map((item) => normalizeText(item)).filter(Boolean))]
      : [];

    recordsToCreate.push({
      kitchenId,
      title,
      description: normalizeText(record.description),
      sourceDescription: normalizeText(record.description),
      sourceType: RecipeSourceType.IMPORTED,
      detailStatus: RecipeDetailStatus.STARTER,
      sourceName: record.source_file
        ? `Starter import • ${normalizeText(record.source_file)}`
        : "Starter import",
      sourceExternalId,
      tags: mergeTagValues(categories, deriveAttributeTagsFromTitle(title)),
      notes: buildNotes(record),
    });
  }

  const batchSize = 100;

  for (let index = 0; index < recordsToCreate.length; index += batchSize) {
    const batch = recordsToCreate.slice(index, index + batchSize);
    await prisma.recipe.createMany({ data: batch });
    created += batch.length;
  }

  console.log(
    JSON.stringify(
      {
        file: resolvedPath,
        total: parsed.length,
        created,
        skipped,
        invalid,
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
