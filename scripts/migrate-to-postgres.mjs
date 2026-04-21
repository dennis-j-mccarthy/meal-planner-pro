import "dotenv/config";
import Database from "better-sqlite3";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const sqlite = new Database("prisma/dev.db");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrateTable(name, query, createFn) {
  const rows = sqlite.prepare(query).all();
  console.log(`${name}: ${rows.length} rows`);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      await createFn(row);
      created++;
    } catch (e) {
      if (e.code === 'P2002') {
        skipped++;
      } else {
        console.error(`  Error on ${name}:`, e.message?.slice(0, 100));
        skipped++;
      }
    }
  }

  console.log(`  → ${created} created, ${skipped} skipped`);
}

async function main() {
  console.log("Migrating SQLite → Prisma Postgres...\n");

  // 1. Kitchens
  await migrateTable("Kitchen", "SELECT * FROM Kitchen", (r) =>
    prisma.kitchen.create({ data: {
      id: r.id, name: r.name, city: r.city, state: r.state,
      serviceArea: r.serviceArea, notes: r.notes,
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    }})
  );

  // 2. Clients
  await migrateTable("Client", "SELECT * FROM Client", (r) =>
    prisma.client.create({ data: {
      id: r.id, kitchenId: r.kitchenId, firstName: r.firstName, lastName: r.lastName,
      email: r.email, phone: r.phone, householdLabel: r.householdLabel,
      dietaryNotes: r.dietaryNotes, address: r.address, active: !!r.active,
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    }})
  );

  // 3. Recipes
  await migrateTable("Recipe", "SELECT * FROM Recipe", (r) =>
    prisma.recipe.create({ data: {
      id: r.id, kitchenId: r.kitchenId, title: r.title, description: r.description,
      sourceDescription: r.sourceDescription, cuisine: r.cuisine,
      sourceType: r.sourceType, detailStatus: r.detailStatus,
      sourceName: r.sourceName, sourceUrl: r.sourceUrl, sourceExternalId: r.sourceExternalId,
      tags: r.tags, dietaryFlags: r.dietaryFlags, ingredientsText: r.ingredientsText,
      instructionsText: r.instructionsText, prepMinutes: r.prepMinutes, cookMinutes: r.cookMinutes,
      servings: r.servings, notes: r.notes, starred: !!r.starred, imageUrl: r.imageUrl,
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    }})
  );

  // 4. CookDates (without finalizedProposalId first to avoid circular FK)
  await migrateTable("CookDate", "SELECT * FROM CookDate", (r) =>
    prisma.cookDate.create({ data: {
      id: r.id, kitchenId: r.kitchenId, clientId: r.clientId,
      scheduledFor: new Date(r.scheduledFor), startTimeLabel: r.startTimeLabel,
      guestCount: r.guestCount, status: r.status, serviceNotes: r.serviceNotes,
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    }})
  );

  // 5. Proposals
  await migrateTable("Proposal", "SELECT * FROM Proposal", (r) =>
    prisma.proposal.create({ data: {
      id: r.id, kitchenId: r.kitchenId, cookDateId: r.cookDateId, title: r.title,
      introMessage: r.introMessage, status: r.status, revisionNotes: r.revisionNotes,
      sentAt: r.sentAt ? new Date(r.sentAt) : null, approvedAt: r.approvedAt ? new Date(r.approvedAt) : null,
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    }})
  );

  // 6. Now set finalizedProposalId on CookDates
  const cookDatesWithProposal = sqlite.prepare(
    "SELECT id, finalizedProposalId FROM CookDate WHERE finalizedProposalId IS NOT NULL"
  ).all();
  for (const r of cookDatesWithProposal) {
    try {
      await prisma.cookDate.update({
        where: { id: r.id },
        data: { finalizedProposalId: r.finalizedProposalId },
      });
    } catch (e) {
      console.error(`  FK update error:`, e.message?.slice(0, 100));
    }
  }
  console.log(`CookDate FK updates: ${cookDatesWithProposal.length}`);

  // 7. ProposalRecipes
  await migrateTable("ProposalRecipe", "SELECT * FROM ProposalRecipe", (r) =>
    prisma.proposalRecipe.create({ data: {
      id: r.id, proposalId: r.proposalId, recipeId: r.recipeId,
      position: r.position, courseLabel: r.courseLabel,
      servingsOverride: r.servingsOverride, notes: r.notes,
    }})
  );

  // 8. Invoices
  await migrateTable("Invoice", "SELECT * FROM Invoice", (r) =>
    prisma.invoice.create({ data: {
      id: r.id, kitchenId: r.kitchenId, clientId: r.clientId,
      invoiceNumber: r.invoiceNumber, invoiceDate: new Date(r.invoiceDate),
      status: r.status, remarks: r.remarks,
      sentAt: r.sentAt ? new Date(r.sentAt) : null, paidAt: r.paidAt ? new Date(r.paidAt) : null,
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    }})
  );

  // 9. InvoiceLineItems
  await migrateTable("InvoiceLineItem", "SELECT * FROM InvoiceLineItem", (r) =>
    prisma.invoiceLineItem.create({ data: {
      id: r.id, invoiceId: r.invoiceId, description: r.description,
      amount: r.amount, position: r.position,
    }})
  );

  // 10. MenuCards
  await migrateTable("MenuCard", "SELECT * FROM MenuCard", (r) =>
    prisma.menuCard.create({ data: {
      id: r.id, kitchenId: r.kitchenId, clientId: r.clientId,
      cookDateId: r.cookDateId, title: r.title,
      menuDate: new Date(r.menuDate), isCoaching: !!r.isCoaching, accepted: !!r.accepted,
      notes: r.notes,
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    }})
  );

  // 11. MenuCardRecipes
  await migrateTable("MenuCardRecipe", "SELECT * FROM MenuCardRecipe", (r) =>
    prisma.menuCardRecipe.create({ data: {
      id: r.id, menuCardId: r.menuCardId, recipeId: r.recipeId,
      position: r.position, category: r.category,
    }})
  );

  // 12. RecipeIntakes
  await migrateTable("RecipeIntake", "SELECT * FROM RecipeIntake", (r) =>
    prisma.recipeIntake.create({ data: {
      id: r.id, kitchenId: r.kitchenId, type: r.type, status: r.status,
      label: r.label, sourceUrl: r.sourceUrl, prompt: r.prompt,
      externalSourceName: r.externalSourceName, notes: r.notes,
      createdAt: new Date(r.createdAt), updatedAt: new Date(r.updatedAt),
    }})
  );

  console.log("\n✅ Migration complete!");
}

main()
  .then(() => { sqlite.close(); return prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    sqlite.close();
    await prisma.$disconnect();
    process.exit(1);
  });
