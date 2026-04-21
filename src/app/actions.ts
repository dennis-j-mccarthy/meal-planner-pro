"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  IntakeType,
  InvoiceStatus,
  ProposalStatus,
  RecipeDetailStatus,
  RecipeSourceType,
} from "@/generated/prisma/client";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { deriveAttributeTagsFromTitle, mergeTagValues } from "@/lib/recipe-tags";
import { generateRecipeImage, generateRecipeText } from "@/lib/gemini";
import { getNextInvoiceNumber } from "@/lib/invoice-number";
import { sendEmail } from "@/lib/email";
import { buildInvoiceHtml } from "@/lib/invoice-template";
import { buildBonAppetitHtml } from "@/lib/bon-appetit-template";
import { generatePdfFromHtml } from "@/lib/generate-pdf";
import { format } from "date-fns";

function requiredText(formData: FormData, key: string) {
  const raw = formData.get(key);

  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new Error(`${key} is required`);
  }

  return raw.trim();
}

function optionalText(formData: FormData, key: string) {
  const raw = formData.get(key);

  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();
  return value.length > 0 ? value : null;
}

function optionalNumber(formData: FormData, key: string) {
  const value = optionalText(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateInput(value: string) {
  return new Date(`${value}T12:00:00`);
}

function revalidateApp() {
  ["/", "/recipes", "/clients", "/cook-dates", "/proposals", "/invoices", "/menu-cards"].forEach((path) =>
    revalidatePath(path),
  );
}

export async function setTheme(formData: FormData) {
  const themeId = requiredText(formData, "themeId");
  const cookieStore = await cookies();
  cookieStore.set("theme", themeId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  cookieStore.delete("theme_custom");
  revalidateApp();
}

export async function setCustomTheme(formData: FormData) {
  const hex = requiredText(formData, "hex");
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error("Invalid hex color");
  }
  const cookieStore = await cookies();
  cookieStore.set("theme_custom", hex, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  cookieStore.set("theme", "custom", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidateApp();
}

export async function logIn() {
  const cookieStore = await cookies();
  cookieStore.set("session", "active", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function logOut() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/");
}

export async function switchKitchen(formData: FormData) {
  const kitchenId = requiredText(formData, "kitchenId");
  const cookieStore = await cookies();
  cookieStore.set("kitchen_id", kitchenId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidateApp();
  redirect("/");
}

export async function toggleRecipeStar(formData: FormData) {
  const recipeId = requiredText(formData, "recipeId");

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { starred: true },
  });

  if (!recipe) {
    throw new Error("Recipe not found");
  }

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { starred: !recipe.starred },
  });

  revalidateApp();
}

export async function deleteRecipe(formData: FormData) {
  const recipeId = requiredText(formData, "recipeId");

  await prisma.recipe.delete({
    where: { id: recipeId },
  });

  revalidateApp();
  redirect("/recipes");
}

export async function createClient(formData: FormData) {
  const kitchen = await getKitchen();

  const emailValue = optionalText(formData, "email")?.toLowerCase();

  await prisma.client.create({
    data: {
      kitchen: { connect: { id: kitchen.id } },
      firstName: requiredText(formData, "firstName"),
      lastName: requiredText(formData, "lastName"),
      ...(emailValue ? { email: emailValue } : {}),
      phone: optionalText(formData, "phone"),
      householdLabel: optionalText(formData, "householdLabel"),
      dietaryNotes: optionalText(formData, "dietaryNotes"),
      address: optionalText(formData, "address"),
    },
  });

  revalidateApp();
}

export async function createCookDate(formData: FormData) {
  const kitchen = await getKitchen();
  const clientId = requiredText(formData, "clientId");
  const scheduledFor = parseDateInput(requiredText(formData, "scheduledFor"));

  const cookDate = await prisma.cookDate.create({
    data: {
      kitchenId: kitchen.id,
      clientId,
      scheduledFor,
      startTimeLabel: optionalText(formData, "startTimeLabel"),
      guestCount: optionalNumber(formData, "guestCount"),
      serviceNotes: optionalText(formData, "serviceNotes"),
    },
  });

  revalidateApp();
  redirect(`/cook-dates/${cookDate.id}`);
}

export async function deleteCookDate(formData: FormData) {
  const cookDateId = requiredText(formData, "cookDateId");

  await prisma.cookDate.delete({
    where: { id: cookDateId },
  });

  revalidateApp();
}

export async function createManualRecipe(formData: FormData) {
  const kitchen = await getKitchen();
  const title = requiredText(formData, "title");
  const description = optionalText(formData, "description");
  const manualTags = optionalText(formData, "tags");

  await prisma.recipe.create({
    data: {
      kitchenId: kitchen.id,
      title,
      description,
      sourceDescription: description,
      cuisine: optionalText(formData, "cuisine"),
      servings: optionalNumber(formData, "servings"),
      prepMinutes: optionalNumber(formData, "prepMinutes"),
      cookMinutes: optionalNumber(formData, "cookMinutes"),
      tags: mergeTagValues(manualTags, deriveAttributeTagsFromTitle(title)),
      dietaryFlags: optionalText(formData, "dietaryFlags"),
      ingredientsText: optionalText(formData, "ingredientsText"),
      instructionsText: optionalText(formData, "instructionsText"),
      detailStatus: RecipeDetailStatus.DRAFT,
      sourceType: RecipeSourceType.MANUAL,
    },
  });

  revalidateApp();
}

export async function queueAiRecipe(formData: FormData) {
  const kitchen = await getKitchen();
  const label = requiredText(formData, "label");
  const prompt = requiredText(formData, "prompt");

  // Generate recipe content via Gemini
  const result = await generateRecipeText(label, null, null, null, null, prompt);

  const recipe = await prisma.recipe.create({
    data: {
      kitchenId: kitchen.id,
      title: label,
      description: result.description,
      sourceDescription: prompt,
      ingredientsText: result.ingredients,
      instructionsText: result.instructions,
      sourceType: RecipeSourceType.AI_GENERATED,
      detailStatus: RecipeDetailStatus.READY,
      sourceName: "AI assistant",
    },
  });

  revalidateApp();
  redirect(`/recipes/${recipe.id}`);
}

export async function queueUrlRecipe(formData: FormData) {
  const kitchen = await getKitchen();
  const sourceUrl = requiredText(formData, "sourceUrl");
  const manualLabel = optionalText(formData, "label");
  const notes = optionalText(formData, "notes");

  let title = manualLabel || "";
  let description: string | null = null;
  let imageUrl: string | null = null;
  let ingredientsText: string | null = null;
  let instructionsText: string | null = null;
  let prepMinutes: number | null = null;
  let cookMinutes: number | null = null;
  let servings: number | null = null;
  let cuisine: string | null = null;

  // Scrape the URL for structured recipe data (JSON-LD)
  const { scrapeRecipeFromUrl, parseDuration, extractImageUrl } = await import("@/lib/recipe-scraper");
  const r = await scrapeRecipeFromUrl(sourceUrl);

  if (r) {
    if (!title && r.name) title = r.name;
    if (r.description) description = r.description;

    imageUrl = extractImageUrl(r.image);

    if (Array.isArray(r.recipeIngredient)) {
      ingredientsText = r.recipeIngredient.join("\n");
    }

    if (Array.isArray(r.recipeInstructions)) {
      instructionsText = r.recipeInstructions
        .map((step: string | { text?: string }, i: number) => {
          const text = typeof step === "string" ? step : step?.text || "";
          return `${i + 1}. ${text.trim()}`;
        })
        .filter((s: string) => s.length > 3)
        .join("\n");
    }

    prepMinutes = parseDuration(r.prepTime);
    cookMinutes = parseDuration(r.cookTime);

    if (r.recipeYield) {
      const yieldVal = Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield;
      const sv = parseInt(String(yieldVal), 10);
      if (Number.isFinite(sv) && sv > 0) servings = sv;
    }

    if (r.recipeCuisine) {
      cuisine = Array.isArray(r.recipeCuisine) ? r.recipeCuisine[0] : r.recipeCuisine;
    }
  }

  // Last resort title from URL
  if (!title) {
    const urlPath = new URL(sourceUrl).pathname;
    title = urlPath
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || sourceUrl;
  }

  // Create the recipe directly
  const recipe = await prisma.recipe.create({
    data: {
      kitchenId: kitchen.id,
      title,
      description,
      sourceDescription: description,
      imageUrl,
      ingredientsText,
      instructionsText,
      prepMinutes,
      cookMinutes,
      servings,
      cuisine,
      sourceType: RecipeSourceType.URL_IMPORT,
      detailStatus: ingredientsText ? RecipeDetailStatus.READY : RecipeDetailStatus.DRAFT,
      sourceUrl,
      sourceName: new URL(sourceUrl).hostname.replace(/^www\./, ""),
      notes,
    },
  });

  revalidateApp();
  redirect(`/recipes/${recipe.id}`);
}

export async function queueApiRecipeSync(formData: FormData) {
  const kitchen = await getKitchen();

  await prisma.recipeIntake.create({
    data: {
      kitchenId: kitchen.id,
      type: IntakeType.API_SYNC,
      label: requiredText(formData, "label"),
      externalSourceName: requiredText(formData, "sourceName"),
      notes: optionalText(formData, "notes"),
    },
  });

  revalidateApp();
}

export async function importEdamamRecipe(formData: FormData) {
  const kitchen = await getKitchen();
  const title = requiredText(formData, "title");
  const sourceUrl = requiredText(formData, "sourceUrl");
  const imageUrl = optionalText(formData, "imageUrl");
  const ingredientsRaw = optionalText(formData, "ingredients");
  const cuisineRaw = optionalText(formData, "cuisine");
  const servingsRaw = optionalText(formData, "servings");
  const totalTimeRaw = optionalText(formData, "totalTime");
  const healthLabels = optionalText(formData, "healthLabels");
  const source = optionalText(formData, "source");

  const servings = servingsRaw ? parseInt(servingsRaw, 10) : null;
  const totalTime = totalTimeRaw ? parseInt(totalTimeRaw, 10) : null;

  const recipe = await prisma.recipe.create({
    data: {
      kitchenId: kitchen.id,
      title,
      description: `From ${source || "Edamam"}`,
      sourceDescription: `Imported via Edamam recipe search`,
      sourceType: RecipeSourceType.EXTERNAL_API,
      detailStatus: ingredientsRaw ? RecipeDetailStatus.READY : RecipeDetailStatus.DRAFT,
      sourceUrl,
      sourceName: source || "Edamam",
      imageUrl,
      ingredientsText: ingredientsRaw,
      cuisine: cuisineRaw,
      servings: Number.isFinite(servings) && servings! > 0 ? servings : null,
      cookMinutes: Number.isFinite(totalTime) && totalTime! > 0 ? totalTime : null,
      dietaryFlags: healthLabels,
    },
  });

  revalidateApp();
  redirect(`/recipes/${recipe.id}`);
}

export async function createProposal(formData: FormData) {
  const cookDateId = requiredText(formData, "cookDateId");
  const recipeIds = formData
    .getAll("recipeIds")
    .map((value) => (typeof value === "string" ? value : ""))
    .filter(Boolean);

  const cookDate = await prisma.cookDate.findUnique({
    where: { id: cookDateId },
    select: { kitchenId: true },
  });

  if (!cookDate) {
    throw new Error("Cook date not found");
  }

  const proposal = await prisma.proposal.create({
    data: {
      kitchenId: cookDate.kitchenId,
      cookDateId,
      title: requiredText(formData, "title"),
      introMessage: optionalText(formData, "introMessage"),
      recipes: {
        create: recipeIds.map((recipeId, index) => ({
          recipeId,
          position: index + 1,
        })),
      },
    },
  });

  revalidateApp();
  redirect(`/proposals/${proposal.id}`);
}

export async function quickCreateProposal(formData: FormData) {
  const cookDateId = requiredText(formData, "cookDateId");

  const cookDate = await prisma.cookDate.findUnique({
    where: { id: cookDateId },
    include: { client: true },
  });

  if (!cookDate) throw new Error("Cook date not found");

  const clientName = `${cookDate.client.firstName} ${cookDate.client.lastName}`;
  const proposal = await prisma.proposal.create({
    data: {
      kitchenId: cookDate.kitchenId,
      cookDateId,
      title: `Menu for ${clientName}`,
    },
  });

  revalidateApp();
  redirect(`/proposals/${proposal.id}`);
}

export async function sendProposal(formData: FormData) {
  const proposalId = requiredText(formData, "proposalId");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { cookDateId: true },
  });

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  await prisma.$transaction([
    prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.SENT,
        sentAt: new Date(),
        revisionNotes: null,
      },
    }),
    prisma.cookDate.update({
      where: { id: proposal.cookDateId },
      data: {
        status: "PROPOSED",
      },
    }),
  ]);

  revalidateApp();
}

export async function requestProposalRevision(formData: FormData) {
  const proposalId = requiredText(formData, "proposalId");

  await prisma.proposal.update({
    where: { id: proposalId },
    data: {
      status: ProposalStatus.REVISIONS_REQUESTED,
      revisionNotes: "Client requested changes before approval.",
    },
  });

  revalidateApp();
}

export async function approveProposal(formData: FormData) {
  const proposalId = requiredText(formData, "proposalId");
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      cookDate: { include: { client: true } },
      recipes: { orderBy: { position: "asc" } },
    },
  });

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  // Approve proposal, archive others, update cook date
  await prisma.$transaction([
    prisma.proposal.updateMany({
      where: {
        cookDateId: proposal.cookDateId,
        id: { not: proposalId },
        status: { in: [ProposalStatus.DRAFT, ProposalStatus.SENT, ProposalStatus.REVISIONS_REQUESTED] },
      },
      data: {
        status: ProposalStatus.ARCHIVED,
      },
    }),
    prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: ProposalStatus.APPROVED,
        approvedAt: new Date(),
        sentAt: new Date(),
        revisionNotes: null,
      },
    }),
    prisma.cookDate.update({
      where: { id: proposal.cookDateId },
      data: {
        status: "APPROVED",
        finalizedProposalId: proposalId,
      },
    }),
  ]);

  // Auto-create a Bon Appetit from the approved proposal
  const clientName = proposal.cookDate.client.firstName;
  const bonAppetit = await prisma.menuCard.create({
    data: {
      kitchenId: proposal.kitchenId,
      clientId: proposal.cookDate.clientId,
      cookDateId: proposal.cookDateId,
      title: `Bon Appetit, ${clientName}!`,
      menuDate: proposal.cookDate.scheduledFor,
      accepted: true,
      recipes: {
        create: proposal.recipes.map((r) => ({
          recipeId: r.recipeId,
          position: r.position,
          category: r.courseLabel,
        })),
      },
    },
  });

  revalidateApp();
  redirect(`/menu-cards/${bonAppetit.id}`);
}

export async function addRecipeToProposal(formData: FormData) {
  const proposalId = requiredText(formData, "proposalId");
  const recipeId = requiredText(formData, "recipeId");

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { status: true },
  });

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  if (proposal.status !== "DRAFT" && proposal.status !== "REVISIONS_REQUESTED") {
    throw new Error("Can only add recipes to draft or revision-requested proposals");
  }

  const maxPos = await prisma.proposalRecipe.aggregate({
    where: { proposalId },
    _max: { position: true },
  });

  try {
    await prisma.proposalRecipe.create({
      data: {
        proposalId,
        recipeId,
        position: (maxPos._max.position ?? 0) + 1,
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      throw new Error("This recipe is already on this proposal");
    }
    throw error;
  }

  revalidateApp();
}

export async function removeRecipeFromProposal(formData: FormData) {
  const proposalRecipeId = requiredText(formData, "proposalRecipeId");

  const proposalRecipe = await prisma.proposalRecipe.findUnique({
    where: { id: proposalRecipeId },
    include: { proposal: { select: { status: true } } },
  });

  if (!proposalRecipe) {
    throw new Error("Proposal recipe not found");
  }

  if (
    proposalRecipe.proposal.status !== "DRAFT" &&
    proposalRecipe.proposal.status !== "REVISIONS_REQUESTED"
  ) {
    throw new Error("Can only remove recipes from editable proposals");
  }

  await prisma.proposalRecipe.delete({
    where: { id: proposalRecipeId },
  });

  revalidateApp();
}

export async function updateProposalRecipeCategory(formData: FormData) {
  const proposalRecipeId = requiredText(formData, "proposalRecipeId");
  const courseLabel = optionalText(formData, "courseLabel");

  await prisma.proposalRecipe.update({
    where: { id: proposalRecipeId },
    data: { courseLabel },
  });

  revalidateApp();
}

export async function generateRecipeImageAction(formData: FormData) {
  const recipeId = requiredText(formData, "recipeId");

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { title: true, description: true, cuisine: true },
  });

  if (!recipe) {
    throw new Error("Recipe not found");
  }

  const imageUrl = await generateRecipeImage(
    recipe.title,
    recipe.description,
    recipe.cuisine,
  );

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { imageUrl },
  });

  revalidateApp();
}

export async function regenerateRecipeTextAction(formData: FormData) {
  const recipeId = requiredText(formData, "recipeId");

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: {
      title: true,
      description: true,
      cuisine: true,
      tags: true,
      dietaryFlags: true,
      servings: true,
      sourceDescription: true,
    },
  });

  if (!recipe) {
    throw new Error("Recipe not found");
  }

  const result = await generateRecipeText(
    recipe.title,
    recipe.cuisine,
    recipe.tags,
    recipe.dietaryFlags,
    recipe.servings,
    recipe.sourceDescription,
  );

  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      description: result.description,
      ingredientsText: result.ingredients,
      instructionsText: result.instructions,
    },
  });

  revalidateApp();
}

export async function regenerateAllRecipeTextAction() {
  const kitchen = await getKitchen();

  const recipes = await prisma.recipe.findMany({
    where: {
      kitchenId: kitchen.id,
      OR: [
        { description: { contains: "imported menu description" } },
        { description: { contains: "structured draft recipe" } },
        { instructionsText: { contains: "imported starter text" } },
        { instructionsText: { contains: "starter description" } },
      ],
    },
    select: {
      id: true,
      title: true,
      cuisine: true,
      tags: true,
      dietaryFlags: true,
      servings: true,
      sourceDescription: true,
    },
  });

  for (const recipe of recipes) {
    try {
      const result = await generateRecipeText(
        recipe.title,
        recipe.cuisine,
        recipe.tags,
        recipe.dietaryFlags,
        recipe.servings,
        recipe.sourceDescription,
      );

      await prisma.recipe.update({
        where: { id: recipe.id },
        data: {
          description: result.description,
          ingredientsText: result.ingredients,
          instructionsText: result.instructions,
        },
      });
    } catch {
      // Skip failed recipes, continue with the rest
      console.error(`Failed to regenerate text for recipe: ${recipe.title}`);
    }
  }

  revalidateApp();
}

// ---------------------------------------------------------------------------
// Invoice actions
// ---------------------------------------------------------------------------

export async function createInvoice(formData: FormData) {
  const kitchen = await getKitchen();
  const clientId = requiredText(formData, "clientId");
  const invoiceDate = parseDateInput(requiredText(formData, "invoiceDate"));
  const remarks = optionalText(formData, "remarks");

  const descriptions = formData.getAll("lineDescription");
  const amounts = formData.getAll("lineAmount");

  const lineItems: { description: string; amount: number; position: number }[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const desc = typeof descriptions[i] === "string" ? (descriptions[i] as string).trim() : "";
    const amt = typeof amounts[i] === "string" ? parseFloat(amounts[i] as string) : NaN;
    if (desc && Number.isFinite(amt) && amt !== 0) {
      lineItems.push({ description: desc, amount: amt, position: i + 1 });
    }
  }

  if (lineItems.length === 0) {
    throw new Error("At least one line item is required");
  }

  const invoiceNumber = await getNextInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      kitchenId: kitchen.id,
      clientId,
      invoiceNumber,
      invoiceDate,
      remarks,
      lineItems: {
        create: lineItems,
      },
    },
  });

  revalidateApp();
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoiceStatus(formData: FormData) {
  const invoiceId = requiredText(formData, "invoiceId");
  const status = requiredText(formData, "status") as InvoiceStatus;

  const updateData: Record<string, unknown> = { status };

  if (status === "SENT") {
    updateData.sentAt = new Date();
  } else if (status === "PAID") {
    updateData.paidAt = new Date();
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
  });

  revalidateApp();
}

export async function deleteInvoice(formData: FormData) {
  const invoiceId = requiredText(formData, "invoiceId");
  const noRedirect = formData.get("noRedirect") === "1";

  await prisma.invoice.delete({
    where: { id: invoiceId },
  });

  revalidateApp();
  if (!noRedirect) redirect("/invoices");
}

// ---------------------------------------------------------------------------
// Menu Card (Bon Appetit) actions
// ---------------------------------------------------------------------------

export async function createMenuCard(formData: FormData) {
  const kitchen = await getKitchen();
  const clientId = requiredText(formData, "clientId");
  const menuDate = parseDateInput(requiredText(formData, "menuDate"));
  const cookDateId = optionalText(formData, "cookDateId");
  const isCoaching = formData.get("isCoaching") === "on";
  const notes = optionalText(formData, "notes");

  const rawRecipeIds = formData.getAll("recipeId") as string[];
  const customTitles = formData.getAll("customTitle") as string[];
  const customDescriptions = formData.getAll("customDescription") as string[];
  const categories = formData.getAll("recipeCategory") as string[];

  // Resolve recipe IDs: existing ones are passed directly, custom ones get created first
  const resolvedRecipes: { recipeId: string; category: string }[] = [];
  let customIdx = 0;

  for (let i = 0; i < rawRecipeIds.length; i++) {
    const category = categories[i]?.trim() || "";

    if (rawRecipeIds[i]) {
      // Existing recipe
      resolvedRecipes.push({ recipeId: rawRecipeIds[i], category });
    } else {
      // Custom recipe — create it in the recipe library
      const title = customTitles[customIdx]?.trim();
      const description = customDescriptions[customIdx]?.trim() || null;
      customIdx++;

      if (!title) continue;

      const newRecipe = await prisma.recipe.create({
        data: {
          kitchenId: kitchen.id,
          title,
          description,
          sourceDescription: description,
          sourceType: RecipeSourceType.MANUAL,
          detailStatus: RecipeDetailStatus.DRAFT,
        },
      });

      resolvedRecipes.push({ recipeId: newRecipe.id, category });
    }
  }

  if (resolvedRecipes.length === 0) {
    throw new Error("At least one recipe is required");
  }

  const clientRecord = await prisma.client.findUnique({
    where: { id: clientId },
    select: { firstName: true },
  });

  const title = `Bon Appetit, ${clientRecord?.firstName || "Client"}!`;

  const menuCard = await prisma.menuCard.create({
    data: {
      kitchenId: kitchen.id,
      clientId,
      cookDateId: cookDateId || null,
      title,
      menuDate,
      isCoaching,
      notes,
      recipes: {
        create: resolvedRecipes.map((r, index) => ({
          recipeId: r.recipeId,
          position: index + 1,
          category: r.category || null,
        })),
      },
    },
  });

  revalidateApp();
  redirect(`/menu-cards/${menuCard.id}`);
}

export async function deleteMenuCard(formData: FormData) {
  const menuCardId = requiredText(formData, "menuCardId");
  const noRedirect = formData.get("noRedirect") === "1";

  await prisma.menuCard.delete({
    where: { id: menuCardId },
  });

  revalidateApp();
  if (!noRedirect) redirect("/menu-cards");
}

export async function acceptMenuCard(formData: FormData) {
  const menuCardId = requiredText(formData, "menuCardId");

  const menuCard = await prisma.menuCard.findUnique({
    where: { id: menuCardId },
    include: {
      recipes: { orderBy: { position: "asc" } },
    },
  });

  if (!menuCard) throw new Error("Menu card not found");

  // Create a cook date if one isn't already linked
  let cookDateId = menuCard.cookDateId;
  if (!cookDateId) {
    const cookDate = await prisma.cookDate.create({
      data: {
        kitchenId: menuCard.kitchenId,
        clientId: menuCard.clientId,
        scheduledFor: menuCard.menuDate,
        status: "APPROVED",
      },
    });
    cookDateId = cookDate.id;
  }

  // Create a proposal from the Bon Appetit recipes and approve it
  const proposal = await prisma.proposal.create({
    data: {
      kitchenId: menuCard.kitchenId,
      cookDateId,
      title: menuCard.title,
      status: ProposalStatus.APPROVED,
      sentAt: new Date(),
      approvedAt: new Date(),
      recipes: {
        create: menuCard.recipes.map((r) => ({
          recipeId: r.recipeId,
          position: r.position,
          courseLabel: r.category,
        })),
      },
    },
  });

  // Link everything together
  await prisma.menuCard.update({
    where: { id: menuCardId },
    data: { accepted: true, cookDateId },
  });

  await prisma.cookDate.update({
    where: { id: cookDateId },
    data: {
      status: "APPROVED",
      finalizedProposalId: proposal.id,
    },
  });

  revalidateApp();
}

// ---------------------------------------------------------------------------
// Email sending actions
// ---------------------------------------------------------------------------

export async function sendInvoiceEmail(formData: FormData) {
  const invoiceId = requiredText(formData, "invoiceId");

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      lineItems: { orderBy: { position: "asc" } },
    },
  });

  if (!invoice) throw new Error("Invoice not found");

  const clientName = `${invoice.client.firstName} ${invoice.client.lastName}`;
  const dateFormatted = format(invoice.invoiceDate, "M/d/yyyy");
  const total = invoice.lineItems.reduce((sum, li) => sum + li.amount, 0);
  const pdfFilename = `${invoice.client.lastName}_Invoice_${invoice.invoiceNumber}.pdf`;

  const html = buildInvoiceHtml({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: dateFormatted,
    clientName,
    clientAddress: invoice.client.address,
    lineItems: invoice.lineItems.map((li) => ({
      description: li.description,
      amount: li.amount,
    })),
    remarks: invoice.remarks,
  });

  const pdfBuffer = await generatePdfFromHtml(html);

  await sendEmail({
    to: "yogabeth@mac.com",
    subject: `Invoice: ${invoice.client.lastName} - ${dateFormatted}`,
    text: [
      `Hi Beth,`,
      ``,
      `Here's the invoice for ${clientName}.`,
      ``,
      `Invoice #${invoice.invoiceNumber}`,
      `Total: $${total.toFixed(2)}`,
      ``,
      `Let me know if you need anything else!`,
      ``,
      `Dennis`,
    ].join("\n"),
    attachmentFilename: pdfFilename,
    attachmentPdf: pdfBuffer,
  });

  // Mark as sent
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "SENT", sentAt: new Date() },
  });

  revalidateApp();
}

export async function sendBonAppetitEmail(formData: FormData) {
  const menuCardId = requiredText(formData, "menuCardId");

  const menuCard = await prisma.menuCard.findUnique({
    where: { id: menuCardId },
    include: {
      client: true,
      recipes: {
        orderBy: { position: "asc" },
        include: { recipe: true },
      },
    },
  });

  if (!menuCard) throw new Error("Menu card not found");

  const dateFormatted = format(menuCard.menuDate, "M/d/yyyy");
  const dateLong = format(menuCard.menuDate, "MMMM d, yyyy");
  const dateFile = format(menuCard.menuDate, "MM-dd-yyyy");
  const pdfFilename = `BonAppetit_${menuCard.client.lastName}_${dateFile}.pdf`;
  const clientName = `${menuCard.client.firstName} ${menuCard.client.lastName}`;

  const html = buildBonAppetitHtml({
    clientFirstNames: menuCard.client.firstName,
    menuDate: dateLong,
    isCoaching: menuCard.isCoaching,
    recipes: menuCard.recipes.map((mr) => ({
      title: mr.recipe.title,
      description: mr.recipe.description,
      category: mr.category,
      ingredientsText: mr.recipe.ingredientsText,
      instructionsText: mr.recipe.instructionsText,
    })),
  });

  const pdfBuffer = await generatePdfFromHtml(html);

  const recipeList = menuCard.recipes
    .map((mr) => `  * ${mr.recipe.title}`)
    .join("\n");

  await sendEmail({
    to: "yogabeth@mac.com",
    subject: `Bon Appetit - ${menuCard.client.firstName} - ${dateFormatted}`,
    text: [
      `Hi Beth,`,
      ``,
      `Here's the Bon Appetit for ${clientName}.`,
      ``,
      `This week's menu:`,
      recipeList,
      ``,
      `Dennis`,
    ].join("\n"),
    attachmentFilename: pdfFilename,
    attachmentPdf: pdfBuffer,
  });

  revalidateApp();
}
