import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(process.cwd(), "backups", timestamp);
  mkdirSync(dir, { recursive: true });

  console.log(`Backing up to: ${dir}\n`);

  const tables = [
    { name: "Kitchen", fn: () => prisma.kitchen.findMany() },
    { name: "Client", fn: () => prisma.client.findMany() },
    { name: "Recipe", fn: () => prisma.recipe.findMany() },
    { name: "CookDate", fn: () => prisma.cookDate.findMany() },
    { name: "Proposal", fn: () => prisma.proposal.findMany() },
    { name: "ProposalRecipe", fn: () => prisma.proposalRecipe.findMany() },
    { name: "MenuCard", fn: () => prisma.menuCard.findMany() },
    { name: "MenuCardRecipe", fn: () => prisma.menuCardRecipe.findMany() },
    { name: "Invoice", fn: () => prisma.invoice.findMany() },
    { name: "InvoiceLineItem", fn: () => prisma.invoiceLineItem.findMany() },
    { name: "RecipeIntake", fn: () => prisma.recipeIntake.findMany() },
  ];

  const manifest = { timestamp, tables: {} };

  for (const t of tables) {
    const rows = await t.fn();
    const file = join(dir, `${t.name}.json`);
    writeFileSync(file, JSON.stringify(rows, null, 2));
    manifest.tables[t.name] = rows.length;
    console.log(`  ${t.name.padEnd(20)} ${rows.length} rows`);
  }

  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Backup complete: ${dir}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
