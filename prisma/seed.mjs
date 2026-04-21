import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  IntakeStatus,
  IntakeType,
  PrismaClient,
  RecipeDetailStatus,
  ProposalStatus,
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

async function main() {
  // Clear everything
  await prisma.menuCardRecipe.deleteMany();
  await prisma.menuCard.deleteMany();
  await prisma.invoiceLineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.proposalRecipe.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.cookDate.deleteMany();
  await prisma.recipeIntake.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.client.deleteMany();
  await prisma.kitchen.deleteMany();

  // =========================================================================
  // Beth's Kitchen — Joyful Wellness with Beth (JWB)
  // =========================================================================
  const jwb = await prisma.kitchen.create({
    data: {
      id: "kitchen_jwb",
      name: "Joyful Wellness with Beth",
      city: "Naples",
      state: "FL",
      serviceArea: "Naples / Southwest Florida",
      notes: "Chef Beth McCarthy — personal chef services, culinary wellness, culinary coaching.",
    },
  });

  await prisma.client.createMany({
    data: [
      {
        id: "client_mannion",
        kitchenId: jwb.id,
        firstName: "Robyn & Rob",
        lastName: "Mannion",
        email: "mannion@client.jwb",
        phone: "310-686-7121",
        address: "1120 12th Ave N\nNaples FL 34102",
      },
      {
        id: "client_ferrante",
        kitchenId: jwb.id,
        firstName: "Molly & Domenic",
        lastName: "Ferrante",
        email: "ferrante@client.jwb",
        phone: "617-335-1785",
        householdLabel: "Also: Nikki",
        address: "118 8th Ave S\nNaples FL 34102",
      },
      {
        id: "client_dries",
        kitchenId: jwb.id,
        firstName: "Kristen & Chris",
        lastName: "Dries",
        email: "dries@client.jwb",
        address: "4215 Crayton Road\nNaples FL 34103",
      },
      {
        id: "client_schwartz",
        kitchenId: jwb.id,
        firstName: "Eric & Alison",
        lastName: "Schwartz",
        email: "ersschwartz@gmail.com",
        phone: "917-674-8987",
        address: "16747 Enclave Circle\nNaples FL 34110",
      },
      {
        id: "client_grundler",
        kitchenId: jwb.id,
        firstName: "Miriam & Frankie",
        lastName: "Grundler",
        email: "grundler@client.jwb",
        address: "5147 Ridge Drive\nPunta Gorda FL 33955",
      },
      {
        id: "client_rice",
        kitchenId: jwb.id,
        firstName: "Kristan",
        lastName: "Rice",
        email: "rice@client.jwb",
        dietaryNotes: "Culinary coaching client",
      },
      {
        id: "client_raphael",
        kitchenId: jwb.id,
        firstName: "Chase & Jamie",
        lastName: "Raphael",
        email: "raphael@client.jwb",
        phone: "267-241-2844",
        address: "3100 Regatta Road\nNaples FL 34103",
        dietaryNotes: "Non-refundable but transferable payment policy.",
      },
      {
        id: "client_elliott",
        kitchenId: jwb.id,
        firstName: "Bob & Cindy",
        lastName: "Elliott",
        email: "elliott@client.jwb",
        address: "Naples area",
      },
    ],
  });

  // =========================================================================
  // Demo Kitchen — Sample data for exploration
  // =========================================================================
  const demo = await prisma.kitchen.create({
    data: {
      id: "kitchen_demo",
      name: "Demo Kitchen",
      city: "Charlotte",
      state: "NC",
      serviceArea: "Nationwide private chef and meal-planning services",
      notes: "Sample workspace for exploring Meal Planner Pro.",
    },
  });

  await prisma.client.createMany({
    data: [
      {
        id: "client_ashford_family",
        kitchenId: demo.id,
        firstName: "Emily",
        lastName: "Ashford",
        email: "emily@ashfordhome.com",
        phone: "704-555-0182",
        householdLabel: "Ashford Family",
        dietaryNotes: "High-protein lunches, no mushrooms, mild spice for children.",
        address: "Myers Park, Charlotte, NC",
      },
      {
        id: "client_lambert_house",
        kitchenId: demo.id,
        firstName: "Marcus",
        lastName: "Lambert",
        email: "marcus@lamberthouse.com",
        phone: "704-555-0109",
        householdLabel: "Lambert House",
        dietaryNotes: "Mediterranean leaning dinners, gluten-light, wants two fish dishes weekly.",
        address: "South End, Charlotte, NC",
      },
      {
        id: "client_rivera_team",
        kitchenId: demo.id,
        firstName: "Nadia",
        lastName: "Rivera",
        email: "nadia@riverawellness.com",
        phone: "305-555-0191",
        householdLabel: "Rivera Wellness",
        dietaryNotes: "Dairy-free, macro-focused, prefers grab-and-go breakfasts.",
        address: "Miami Beach, FL",
      },
    ],
  });

  await prisma.recipe.createMany({
    data: [
      {
        id: "recipe_chicken_piccata",
        kitchenId: demo.id,
        title: "Lemon Chicken Piccata",
        description: "Bright weeknight-ready chicken with capers, white wine, and charred broccolini.",
        sourceDescription: "Bright weeknight-ready chicken with capers, white wine, and charred broccolini.",
        cuisine: "Italian-American",
        sourceType: RecipeSourceType.IMPORTED,
        detailStatus: RecipeDetailStatus.READY,
        sourceName: "Founding CSV import",
        tags: mergeTagValues("family-style, freezer-friendly", deriveAttributeTagsFromTitle("Lemon Chicken Piccata")),
        dietaryFlags: "high-protein",
        ingredientsText: "- Chicken cutlets\n- Capers\n- White wine\n- Lemon\n- Broccolini",
        instructionsText: "1. Season and sear the chicken cutlets.\n2. Build a lemon-caper pan sauce with white wine.\n3. Roast or char the broccolini.\n4. Finish the chicken in the sauce and serve hot.",
        prepMinutes: 25,
        cookMinutes: 20,
        servings: 4,
      },
      {
        id: "recipe_salmon_harissa",
        kitchenId: demo.id,
        title: "Harissa Roasted Salmon",
        description: "Sheet-pan salmon with blistered tomatoes, herbs, and citrus yogurt.",
        sourceDescription: "Sheet-pan salmon with blistered tomatoes, herbs, and citrus yogurt.",
        cuisine: "Mediterranean",
        sourceType: RecipeSourceType.EXTERNAL_API,
        detailStatus: RecipeDetailStatus.READY,
        sourceName: "Chef API pilot",
        tags: mergeTagValues("fish, weeknight", deriveAttributeTagsFromTitle("Harissa Roasted Salmon")),
        dietaryFlags: "gluten-free",
        ingredientsText: "- Salmon fillets\n- Harissa\n- Cherry tomatoes\n- Fresh herbs\n- Citrus yogurt",
        instructionsText: "1. Coat the salmon with harissa and seasoning.\n2. Roast the salmon with tomatoes on a sheet pan.\n3. Stir together the citrus yogurt.\n4. Finish with herbs and serve.",
        prepMinutes: 15,
        cookMinutes: 18,
        servings: 4,
      },
      {
        id: "recipe_turkey_meatballs",
        kitchenId: demo.id,
        title: "Basil Turkey Meatballs",
        description: "Tender turkey meatballs with roasted garlic marinara and whipped ricotta.",
        sourceDescription: "Tender turkey meatballs with roasted garlic marinara and whipped ricotta.",
        cuisine: "Italian",
        sourceType: RecipeSourceType.MANUAL,
        detailStatus: RecipeDetailStatus.READY,
        tags: mergeTagValues("meal-prep, family-style", deriveAttributeTagsFromTitle("Basil Turkey Meatballs")),
        dietaryFlags: "high-protein",
        ingredientsText: "- Ground turkey\n- Basil\n- Garlic\n- Marinara\n- Ricotta",
        instructionsText: "1. Mix the turkey with basil and aromatics.\n2. Form and bake or pan-sear the meatballs.\n3. Warm the roasted garlic marinara.\n4. Plate with whipped ricotta and sauce.",
        prepMinutes: 30,
        cookMinutes: 25,
        servings: 6,
      },
      {
        id: "recipe_coconut_oats",
        kitchenId: demo.id,
        title: "Coconut Overnight Oats",
        description: "Dairy-free overnight oats with chia, berries, and toasted pumpkin seeds.",
        sourceDescription: "Dairy-free overnight oats with chia, berries, and toasted pumpkin seeds.",
        cuisine: "Breakfast",
        sourceType: RecipeSourceType.AI_GENERATED,
        detailStatus: RecipeDetailStatus.READY,
        sourceName: "AI assistant",
        tags: mergeTagValues("breakfast, grab-and-go", deriveAttributeTagsFromTitle("Coconut Overnight Oats")),
        dietaryFlags: "dairy-free",
        ingredientsText: "- Rolled oats\n- Coconut milk\n- Chia seeds\n- Berries\n- Pumpkin seeds",
        instructionsText: "1. Combine oats, coconut milk, and chia.\n2. Chill overnight.\n3. Top with berries and toasted pumpkin seeds before service.",
        prepMinutes: 10,
        cookMinutes: 0,
        servings: 5,
      },
      {
        id: "recipe_zaatar_chicken",
        kitchenId: demo.id,
        title: "Za'atar Chicken Bowls",
        description: "Roasted chicken thighs, turmeric rice, cucumber salad, and tahini drizzle.",
        sourceDescription: "Roasted chicken thighs, turmeric rice, cucumber salad, and tahini drizzle.",
        cuisine: "Middle Eastern",
        sourceType: RecipeSourceType.URL_IMPORT,
        detailStatus: RecipeDetailStatus.READY,
        sourceUrl: "https://example.com/zaatar-chicken-bowls",
        tags: mergeTagValues("lunch, high-protein", deriveAttributeTagsFromTitle("Za'atar Chicken Bowls")),
        dietaryFlags: "gluten-free",
        ingredientsText: "- Chicken thighs\n- Za'atar\n- Turmeric rice\n- Cucumber salad\n- Tahini",
        instructionsText: "1. Season and roast the chicken thighs.\n2. Cook the turmeric rice.\n3. Toss the cucumber salad.\n4. Finish the bowls with tahini drizzle.",
        prepMinutes: 20,
        cookMinutes: 30,
        servings: 4,
      },
      {
        id: "recipe_shrimp_orzo",
        kitchenId: demo.id,
        title: "Shrimp and Spinach Orzo",
        description: "Garlicky shrimp folded into lemony orzo with spinach and parmesan.",
        sourceDescription: "Garlicky shrimp folded into lemony orzo with spinach and parmesan.",
        cuisine: "Mediterranean",
        sourceType: RecipeSourceType.IMPORTED,
        detailStatus: RecipeDetailStatus.READY,
        sourceName: "Founding CSV import",
        tags: mergeTagValues("seafood, comfort", deriveAttributeTagsFromTitle("Shrimp and Spinach Orzo")),
        dietaryFlags: "nut-free",
        ingredientsText: "- Shrimp\n- Orzo\n- Garlic\n- Spinach\n- Parmesan",
        instructionsText: "1. Sear the shrimp with garlic.\n2. Cook the orzo until tender.\n3. Fold in spinach, lemon, and parmesan.\n4. Finish with the shrimp and serve.",
        prepMinutes: 18,
        cookMinutes: 18,
        servings: 4,
      },
    ],
  });

  await prisma.cookDate.createMany({
    data: [
      {
        id: "cookdate_ashford_march",
        kitchenId: demo.id,
        clientId: "client_ashford_family",
        scheduledFor: new Date("2026-03-19T12:00:00.000Z"),
        startTimeLabel: "10:00 AM prep window",
        guestCount: 4,
        status: "PROPOSED",
        serviceNotes: "Two adults, two children. Keep lunches packable and dinners reheatable.",
      },
      {
        id: "cookdate_lambert_march",
        kitchenId: demo.id,
        clientId: "client_lambert_house",
        scheduledFor: new Date("2026-03-22T12:00:00.000Z"),
        startTimeLabel: "11:30 AM arrival",
        guestCount: 2,
        status: "APPROVED",
        serviceNotes: "Include two seafood dinners and one brunch item.",
      },
      {
        id: "cookdate_rivera_march",
        kitchenId: demo.id,
        clientId: "client_rivera_team",
        scheduledFor: new Date("2026-03-25T12:00:00.000Z"),
        startTimeLabel: "8:00 AM delivery prep",
        guestCount: 3,
        status: "DRAFT",
        serviceNotes: "Breakfasts and macro-friendly lunches for post-training week.",
      },
    ],
  });

  await prisma.proposal.create({
    data: {
      id: "proposal_ashford",
      kitchenId: demo.id,
      cookDateId: "cookdate_ashford_march",
      title: "Ashford family weekly menu",
      introMessage: "Balanced, kid-friendly lineup with lunch support and two dinner centerpieces.",
      status: ProposalStatus.SENT,
      sentAt: new Date("2026-03-14T15:00:00.000Z"),
      recipes: {
        create: [
          { recipeId: "recipe_chicken_piccata", position: 1 },
          { recipeId: "recipe_turkey_meatballs", position: 2 },
          { recipeId: "recipe_coconut_oats", position: 3 },
        ],
      },
    },
  });

  await prisma.proposal.create({
    data: {
      id: "proposal_lambert",
      kitchenId: demo.id,
      cookDateId: "cookdate_lambert_march",
      title: "Lambert spring seafood set",
      introMessage: "Mediterranean-leaning meals with one brunch prep and two fish-forward dinners.",
      status: ProposalStatus.APPROVED,
      sentAt: new Date("2026-03-10T14:00:00.000Z"),
      approvedAt: new Date("2026-03-11T09:30:00.000Z"),
      recipes: {
        create: [
          { recipeId: "recipe_salmon_harissa", position: 1 },
          { recipeId: "recipe_shrimp_orzo", position: 2 },
          { recipeId: "recipe_zaatar_chicken", position: 3 },
        ],
      },
    },
  });

  await prisma.cookDate.update({
    where: { id: "cookdate_lambert_march" },
    data: {
      finalizedProposalId: "proposal_lambert",
    },
  });

  await prisma.recipeIntake.createMany({
    data: [
      {
        id: "intake_url_one",
        kitchenId: demo.id,
        type: IntakeType.URL_IMPORT,
        status: IntakeStatus.QUEUED,
        label: "Sheet-pan shawarma bowls",
        sourceUrl: "https://example.com/shawarma-bowls",
        notes: "Add to the lunch rotation for high-protein clients.",
      },
      {
        id: "intake_ai_one",
        kitchenId: demo.id,
        type: IntakeType.AI_GENERATION,
        status: IntakeStatus.PROCESSING,
        label: "Dairy-free breakfast jars",
        prompt: "Create five breakfast recipes optimized for dairy-free athletic clients.",
      },
      {
        id: "intake_api_one",
        kitchenId: demo.id,
        type: IntakeType.API_SYNC,
        status: IntakeStatus.QUEUED,
        label: "Mediterranean spring pull",
        externalSourceName: "Chef API pilot",
        notes: "Pull seafood-forward dinners and grain bowls.",
      },
    ],
  });
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
