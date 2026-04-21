import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RecipeSourceType, RecipeDetailStatus, ProposalStatus, InvoiceStatus } from "../src/generated/prisma/client.ts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_ID = "kitchen_demo";

// Date helpers
const today = new Date();
today.setHours(12, 0, 0, 0);

function daysFromNow(days) {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d;
}

async function wipeDemo() {
  // Delete cascade: delete in order of dependencies
  await prisma.invoiceLineItem.deleteMany({
    where: { invoice: { kitchenId: DEMO_ID } },
  });
  await prisma.invoice.deleteMany({ where: { kitchenId: DEMO_ID } });

  await prisma.menuCardRecipe.deleteMany({
    where: { menuCard: { kitchenId: DEMO_ID } },
  });
  await prisma.menuCard.deleteMany({ where: { kitchenId: DEMO_ID } });

  // Clear finalizedProposalId to break circular FK
  await prisma.cookDate.updateMany({
    where: { kitchenId: DEMO_ID },
    data: { finalizedProposalId: null },
  });
  await prisma.proposalRecipe.deleteMany({
    where: { proposal: { kitchenId: DEMO_ID } },
  });
  await prisma.proposal.deleteMany({ where: { kitchenId: DEMO_ID } });
  await prisma.cookDate.deleteMany({ where: { kitchenId: DEMO_ID } });
  await prisma.client.deleteMany({ where: { kitchenId: DEMO_ID } });

  console.log("Demo data wiped");
}

async function main() {
  await wipeDemo();

  // Ensure demo kitchen exists
  await prisma.kitchen.upsert({
    where: { id: DEMO_ID },
    create: {
      id: DEMO_ID,
      name: "Demo Kitchen",
      city: "San Francisco",
      state: "CA",
      serviceArea: "Bay Area private chef services",
      notes: "Try out Meal Planner Pro with this sample kitchen. Dates refresh automatically.",
    },
    update: {},
  });

  // ── CLIENTS ──
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        id: "demo_client_ashford",
        kitchenId: DEMO_ID,
        firstName: "Emily & Marcus",
        lastName: "Ashford",
        email: "emily@ashfordhome.example",
        phone: "(415) 555-0182",
        householdLabel: "Ashford Family",
        dietaryNotes: "High-protein lunches, no mushrooms, mild spice for the kids.",
        address: "Pacific Heights, San Francisco, CA",
      },
    }),
    prisma.client.create({
      data: {
        id: "demo_client_lambert",
        kitchenId: DEMO_ID,
        firstName: "Priya",
        lastName: "Lambert",
        email: "priya@lamberthouse.example",
        phone: "(415) 555-0109",
        householdLabel: "Lambert House",
        dietaryNotes: "Mediterranean, gluten-light. Wants two fish dishes weekly.",
        address: "Noe Valley, San Francisco, CA",
      },
    }),
    prisma.client.create({
      data: {
        id: "demo_client_rivera",
        kitchenId: DEMO_ID,
        firstName: "Nadia",
        lastName: "Rivera",
        email: "nadia@riverawellness.example",
        phone: "(415) 555-0191",
        householdLabel: "Rivera Wellness",
        dietaryNotes: "Dairy-free, macro-focused, prefers grab-and-go breakfasts.",
        address: "Mission District, San Francisco, CA",
      },
    }),
    prisma.client.create({
      data: {
        id: "demo_client_kim",
        kitchenId: DEMO_ID,
        firstName: "Jason",
        lastName: "Kim",
        email: "jason.kim@example.com",
        phone: "(415) 555-0224",
        householdLabel: "The Kim Household",
        dietaryNotes: "Korean-American fusion, loves bold flavors. Wife prefers lighter fare.",
        address: "Russian Hill, San Francisco, CA",
      },
    }),
    prisma.client.create({
      data: {
        id: "demo_client_okafor",
        kitchenId: DEMO_ID,
        firstName: "Amara",
        lastName: "Okafor",
        email: "amara@okaforfamily.example",
        phone: "(415) 555-0367",
        householdLabel: "The Okafor Family",
        dietaryNotes: "Vegetarian, West African influences welcome. Nut-free for youngest child.",
        address: "Potrero Hill, San Francisco, CA",
      },
    }),
  ]);
  console.log(`Created ${clients.length} clients`);

  // Grab a variety of existing recipes from JWB to use in the demo
  const recipes = await prisma.recipe.findMany({
    where: {
      kitchenId: "kitchen_jwb",
      detailStatus: RecipeDetailStatus.STARTER,
      title: {
        in: [
          "Asian Chicken Salad",
          "Asian Cucumber Salad",
          "Baked Chicken Parmesan",
          "Beef Bourguignon",
          "Beef Stew",
          "Beans and Greens Quesadillas",
          "Blueberry Blackberry Sorbet",
          "Cauliflower Stuffing",
          "Chicken Parmesan",
          "Chicken Waldorf Salad with Lemon-Beet Hummus",
          "Homemade Granola",
          "Caprese Salad",
          "Curried Chicken Salad",
          "Fish en Papillote",
          "Fresh Fruit Salad",
          "Immunity Shots",
          "Mango Chia Pudding",
          "Mango Curry Chicken Salad",
          "Mixed Fruit Salad",
          "Weekly Fruit Bowl",
          "Weekly Salad",
          "Winter Salad",
          "Zucchini Lasagna Rolls",
        ],
      },
    },
    take: 25,
  });
  console.log(`Using ${recipes.length} reference recipes`);

  if (recipes.length < 6) {
    console.log("⚠️  Not enough recipes — run the starter import first. Aborting.");
    return;
  }

  function pickRecipes(n) {
    const shuffled = [...recipes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  }

  // ── COOK DATES ──
  // Past (completed), approved upcoming, proposed, and a draft
  const cookDateDefs = [
    {
      id: "demo_cd_past_1",
      clientId: "demo_client_ashford",
      scheduledFor: daysFromNow(-14),
      status: "COMPLETED",
      guestCount: 4,
      startTimeLabel: "10:00 AM prep window",
      serviceNotes: "Family of four. Packable lunches and reheatable dinners.",
      menu: { approved: true, bonAppetit: true, invoice: { paid: true, total: 850 } },
    },
    {
      id: "demo_cd_past_2",
      clientId: "demo_client_lambert",
      scheduledFor: daysFromNow(-7),
      status: "COMPLETED",
      guestCount: 2,
      startTimeLabel: "11:30 AM arrival",
      serviceNotes: "Mediterranean-leaning dinners, two seafood entrees.",
      menu: { approved: true, bonAppetit: true, invoice: { paid: true, total: 720 } },
    },
    {
      id: "demo_cd_upcoming_1",
      clientId: "demo_client_ashford",
      scheduledFor: daysFromNow(3),
      status: "APPROVED",
      guestCount: 4,
      startTimeLabel: "10:00 AM prep window",
      serviceNotes: "Kid-friendly comfort food this week. Two dinners, three lunches.",
      menu: { approved: true, bonAppetit: true, invoice: { paid: false, total: 920 } },
    },
    {
      id: "demo_cd_upcoming_2",
      clientId: "demo_client_rivera",
      scheduledFor: daysFromNow(5),
      status: "PROPOSED",
      guestCount: 3,
      startTimeLabel: "8:00 AM delivery prep",
      serviceNotes: "Post-training week — macro-friendly, grab-and-go breakfasts.",
      menu: { approved: false, bonAppetit: false, invoice: null },
    },
    {
      id: "demo_cd_upcoming_3",
      clientId: "demo_client_kim",
      scheduledFor: daysFromNow(10),
      status: "APPROVED",
      guestCount: 4,
      startTimeLabel: "Noon arrival",
      serviceNotes: "Korean fusion night. Family-style spread.",
      menu: { approved: true, bonAppetit: true, invoice: { paid: false, total: 1150 } },
    },
    {
      id: "demo_cd_upcoming_4",
      clientId: "demo_client_lambert",
      scheduledFor: daysFromNow(14),
      status: "PROPOSED",
      guestCount: 6,
      startTimeLabel: "11:30 AM arrival",
      serviceNotes: "Dinner party for 6. Mediterranean theme, wine pairing suggestions welcome.",
      menu: { approved: false, bonAppetit: false, invoice: null },
    },
    {
      id: "demo_cd_upcoming_5",
      clientId: "demo_client_okafor",
      scheduledFor: daysFromNow(17),
      status: "DRAFT",
      guestCount: 5,
      startTimeLabel: "10:30 AM",
      serviceNotes: "Vegetarian week. Nut-free. West African flavors encouraged.",
      menu: { approved: false, bonAppetit: false, invoice: null },
    },
    {
      id: "demo_cd_upcoming_6",
      clientId: "demo_client_ashford",
      scheduledFor: daysFromNow(21),
      status: "DRAFT",
      guestCount: 4,
      startTimeLabel: "10:00 AM prep window",
      serviceNotes: "Standing weekly service. Usual preferences apply.",
      menu: { approved: false, bonAppetit: false, invoice: null },
    },
  ];

  let invoiceCounter = 1001;

  for (const def of cookDateDefs) {
    const cookDate = await prisma.cookDate.create({
      data: {
        id: def.id,
        kitchenId: DEMO_ID,
        clientId: def.clientId,
        scheduledFor: def.scheduledFor,
        startTimeLabel: def.startTimeLabel,
        guestCount: def.guestCount,
        status: def.status,
        serviceNotes: def.serviceNotes,
      },
    });

    const client = clients.find((c) => c.id === def.clientId);
    const menuRecipes = pickRecipes(5 + Math.floor(Math.random() * 3));

    // Create proposal
    const proposalStatus = def.menu.approved
      ? ProposalStatus.APPROVED
      : def.status === "PROPOSED"
        ? ProposalStatus.SENT
        : ProposalStatus.DRAFT;

    const proposal = await prisma.proposal.create({
      data: {
        kitchenId: DEMO_ID,
        cookDateId: cookDate.id,
        title: `Menu for ${client.firstName} ${client.lastName}`,
        status: proposalStatus,
        sentAt: def.menu.approved ? daysFromNow(-3) : null,
        approvedAt: def.menu.approved ? daysFromNow(-2) : null,
        recipes: {
          create: menuRecipes.map((r, i) => {
            const categories = ["Breakfast", "Entrees", "Salad", "Side", "Dessert"];
            return {
              recipeId: r.id,
              position: i + 1,
              courseLabel: categories[i % categories.length],
            };
          }),
        },
      },
    });

    if (def.menu.approved) {
      await prisma.cookDate.update({
        where: { id: cookDate.id },
        data: { finalizedProposalId: proposal.id },
      });

      if (def.menu.bonAppetit) {
        await prisma.menuCard.create({
          data: {
            kitchenId: DEMO_ID,
            clientId: def.clientId,
            cookDateId: cookDate.id,
            title: `Bon Appetit, ${client.firstName}!`,
            menuDate: def.scheduledFor,
            accepted: true,
            recipes: {
              create: menuRecipes.map((r, i) => {
                const categories = ["Breakfast", "Entrees", "Salad", "Side", "Dessert"];
                return {
                  recipeId: r.id,
                  position: i + 1,
                  category: categories[i % categories.length],
                };
              }),
            },
          },
        });
      }
    }

    if (def.menu.invoice) {
      const invNum = `${String(def.scheduledFor.getMonth() + 1).padStart(2, "0")}-${invoiceCounter++}`;
      await prisma.invoice.create({
        data: {
          kitchenId: DEMO_ID,
          clientId: def.clientId,
          invoiceNumber: invNum,
          invoiceDate: daysFromNow(def.scheduledFor < today ? -5 : -1),
          status: def.menu.invoice.paid ? InvoiceStatus.PAID : InvoiceStatus.SENT,
          sentAt: daysFromNow(def.scheduledFor < today ? -4 : 0),
          paidAt: def.menu.invoice.paid ? daysFromNow(-1) : null,
          lineItems: {
            create: [
              {
                description: "Personal Chef Service",
                amount: def.menu.invoice.total - 60,
                position: 1,
              },
              {
                description: "Groceries",
                amount: 60,
                position: 2,
              },
            ],
          },
        },
      });
    }
  }

  console.log(`Created ${cookDateDefs.length} cook dates with menus and invoices`);

  // ── STANDALONE INVOICES ──
  await prisma.invoice.create({
    data: {
      kitchenId: DEMO_ID,
      clientId: "demo_client_kim",
      invoiceNumber: `${String(today.getMonth() + 1).padStart(2, "0")}-1099`,
      invoiceDate: daysFromNow(-2),
      status: InvoiceStatus.DRAFT,
      lineItems: {
        create: [
          {
            description: "Culinary Coaching Session",
            amount: 350,
            position: 1,
          },
        ],
      },
    },
  });

  console.log("\n✅ Demo refreshed!");
  console.log(`   Today: ${today.toDateString()}`);
  console.log(`   Cook dates from ${daysFromNow(-14).toDateString()} to ${daysFromNow(21).toDateString()}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
