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
import { parseDishQuota, serializeDishQuota } from "@/lib/dish-quota";
import { generateRecipeImage, generateRecipeText, extractRecipeFromImage, generateRecipeNutrition } from "@/lib/gemini";
import { getNextInvoiceNumber } from "@/lib/invoice-number";
import { sendEmail, sendPlainEmail } from "@/lib/email";
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

/** Join repeated checkbox values (formData.getAll) into a comma-separated string. */
function textList(formData: FormData, key: string) {
  const values = formData
    .getAll(key)
    .map((v) => String(v).trim())
    .filter(Boolean);
  return values.length > 0 ? values.join(", ") : null;
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

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://meal-planner-pro-puce.vercel.app"
  );
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

export async function enterDemo() {
  const cookieStore = await cookies();
  cookieStore.set("demo_mode", "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });
  redirect("/");
}

export async function exitDemo() {
  const cookieStore = await cookies();
  cookieStore.delete("demo_mode");
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

export async function updateRecipe(formData: FormData) {
  const kitchen = await getKitchen();
  const recipeId = requiredText(formData, "recipeId");

  // Ensure the recipe belongs to the active kitchen before editing.
  const existing = await prisma.recipe.findFirst({
    where: { id: recipeId, kitchenId: kitchen.id },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Recipe not found");
  }

  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      title: requiredText(formData, "title"),
      cuisine: optionalText(formData, "cuisine"),
      servings: optionalNumber(formData, "servings"),
      prepMinutes: optionalNumber(formData, "prepMinutes"),
      cookMinutes: optionalNumber(formData, "cookMinutes"),
      tags: optionalText(formData, "tags"),
      dietaryFlags: optionalText(formData, "dietaryFlags"),
      description: optionalText(formData, "description"),
      ingredientsText: optionalText(formData, "ingredientsText"),
      instructionsText: optionalText(formData, "instructionsText"),
    },
  });

  revalidateApp();
  revalidatePath(`/recipes/${recipeId}`);
}

export async function deleteRecipe(formData: FormData) {
  const recipeId = requiredText(formData, "recipeId");

  await prisma.recipe.delete({
    where: { id: recipeId },
  });

  revalidateApp();
  redirect("/recipes");
}

// Compose a printable address from structured parts (street / city / state /
// zip) so existing consumers that read Client.address (invoices, menu cards,
// PDFs) keep working. First line is the street, second is "City, ST ZIP".
function clientAddressFields(formData: FormData) {
  const street = optionalText(formData, "street");
  const city = optionalText(formData, "city");
  const state = optionalText(formData, "state");
  const zip = optionalText(formData, "zip");
  const cityStateZip = [[city, state].filter(Boolean).join(", "), zip]
    .filter(Boolean)
    .join(" ");
  const address = [street, cityStateZip].filter(Boolean).join("\n") || null;
  return { street, city, state, zip, address };
}

export async function createClient(formData: FormData) {
  const kitchen = await getKitchen();
  const addr = clientAddressFields(formData);

  await prisma.client.create({
    data: {
      kitchen: { connect: { id: kitchen.id } },
      firstName: requiredText(formData, "firstName"),
      lastName: requiredText(formData, "lastName"),
      email: requiredText(formData, "email").toLowerCase(),
      secondaryEmail: optionalText(formData, "secondaryEmail")?.toLowerCase() ?? null,
      phone: optionalText(formData, "phone"),
      householdLabel: optionalText(formData, "householdLabel"),
      dietaryNotes: optionalText(formData, "dietaryNotes"),
      inclusions: textList(formData, "inclusions"),
      exclusions: textList(formData, "exclusions"),
      profileNotes: optionalText(formData, "profileNotes"),
      dishQuota: serializeDishQuota(parseDishQuota(optionalText(formData, "dishQuota"))),
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      address: addr.address,
    },
  });

  revalidateApp();
}

export async function updateClient(formData: FormData) {
  const clientId = requiredText(formData, "clientId");
  const addr = clientAddressFields(formData);

  await prisma.client.update({
    where: { id: clientId },
    data: {
      firstName: requiredText(formData, "firstName"),
      lastName: requiredText(formData, "lastName"),
      email: requiredText(formData, "email").toLowerCase(),
      secondaryEmail: optionalText(formData, "secondaryEmail")?.toLowerCase() ?? null,
      phone: optionalText(formData, "phone"),
      householdLabel: optionalText(formData, "householdLabel"),
      dietaryNotes: optionalText(formData, "dietaryNotes"),
      inclusions: textList(formData, "inclusions"),
      exclusions: textList(formData, "exclusions"),
      profileNotes: optionalText(formData, "profileNotes"),
      dishQuota: serializeDishQuota(parseDishQuota(optionalText(formData, "dishQuota"))),
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      // Only recompose address when structured parts were supplied, so we don't
      // wipe a legacy free-text address on clients that predate these fields.
      ...(addr.address ? { address: addr.address } : {}),
    },
  });

  revalidateApp();
}

export async function deleteClient(formData: FormData) {
  const clientId = requiredText(formData, "clientId");
  await prisma.client.delete({ where: { id: clientId } });
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

export async function createRecipeFromPhoto(formData: FormData) {
  const kitchen = await getKitchen();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No photo provided");
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mimeType = file.type || "image/jpeg";

  const extracted = await extractRecipeFromImage(base64, mimeType);

  const recipe = await prisma.recipe.create({
    data: {
      kitchenId: kitchen.id,
      title: extracted.title,
      description: extracted.description || null,
      sourceDescription: "Imported from a photo of a recipe",
      cuisine: extracted.cuisine,
      servings: extracted.servings,
      prepMinutes: extracted.prepMinutes,
      cookMinutes: extracted.cookMinutes,
      tags: mergeTagValues(
        extracted.tags,
        deriveAttributeTagsFromTitle(extracted.title),
      ),
      ingredientsText: extracted.ingredients || null,
      instructionsText: extracted.instructions || null,
      sourceType: RecipeSourceType.IMPORTED,
      detailStatus: RecipeDetailStatus.READY,
      sourceName: "Photo import",
    },
  });

  revalidateApp();
  redirect(`/recipes/${recipe.id}`);
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
  // Returned (rather than redirected) so the client can show progress and tell
  // the user when a site didn't cooperate — "draft" means no ingredients were
  // scraped and the recipe needs filling in.
  return {
    recipeId: recipe.id,
    status: ingredientsText ? ("ready" as const) : ("draft" as const),
  };
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
    select: { cookDateId: true, shareToken: true },
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
        // Mint the public review link on first send.
        shareToken: proposal.shareToken ?? crypto.randomUUID(),
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

/**
 * Public, no-login submission from the client review page. Looked up by
 * shareToken only — never kitchen-scoped. Records the client's comment,
 * approve/changes choice, and which dishes they removed, then notifies Beth.
 */
export async function submitProposalReview(formData: FormData) {
  const token = requiredText(formData, "token");
  const decision = requiredText(formData, "decision"); // "approve" | "changes"
  const comment = optionalText(formData, "comment");
  const removedIds = formData.getAll("removed").map(String).filter(Boolean);

  const proposal = await prisma.proposal.findUnique({
    where: { shareToken: token },
    include: {
      cookDate: { include: { client: true } },
      recipes: { include: { recipe: { select: { title: true } } } },
    },
  });

  if (!proposal) {
    throw new Error("This review link is no longer active.");
  }

  const approved = decision === "approve";
  const removedSet = new Set(removedIds);

  await prisma.$transaction([
    prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        clientApproved: approved,
        clientComment: comment,
        clientSubmittedAt: new Date(),
      },
    }),
    // Flag the dishes the client subtracted (reset the rest) — advisory only.
    ...proposal.recipes.map((pr) =>
      prisma.proposalRecipe.update({
        where: { id: pr.id },
        data: { clientRemoved: removedSet.has(pr.id) },
      }),
    ),
  ]);

  // Notify Beth that the client responded.
  const clientName = `${proposal.cookDate.client.firstName} ${proposal.cookDate.client.lastName}`.trim();
  const removedTitles = proposal.recipes
    .filter((pr) => removedSet.has(pr.id))
    .map((pr) => pr.recipe.title);
  const notifyEmail = process.env.REVIEW_NOTIFY_EMAIL || "yogabeth@mac.com";

  try {
    await sendPlainEmail({
      to: notifyEmail,
      subject: `${clientName} ${approved ? "approved" : "requested changes to"} their meal plan`,
      text: [
        `${clientName} just reviewed "${proposal.title}".`,
        "",
        `Response: ${approved ? "Approved 👍" : "Requested changes"}`,
        removedTitles.length
          ? `Removed: ${removedTitles.join(", ")}`
          : "Removed: (none)",
        comment ? `\nComment:\n${comment}` : "\nComment: (none)",
        "",
        `Review and finalize: ${appBaseUrl()}/proposals/${proposal.id}`,
      ].join("\n"),
    });
  } catch {
    // Don't fail the client's submission if the email can't be sent.
  }

  revalidatePath(`/proposals/${proposal.id}`);
  return { ok: true };
}

/** Email the client their no-login review link. Kitchen-scoped. */
export async function emailProposalLinkToClient(formData: FormData) {
  const kitchen = await getKitchen();
  const proposalId = requiredText(formData, "proposalId");

  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, kitchenId: kitchen.id },
    include: { cookDate: { include: { client: true } } },
  });

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  const clientEmail = proposal.cookDate.client.email;
  if (!clientEmail) {
    throw new Error("This client has no email address on file.");
  }

  let token = proposal.shareToken;
  if (!token) {
    token = crypto.randomUUID();
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { shareToken: token },
    });
  }

  const reviewUrl = `${appBaseUrl()}/review/${token}`;
  const firstName = proposal.cookDate.client.firstName;

  await sendPlainEmail({
    to: clientEmail,
    subject: `Your meal plan from ${kitchen.name} is ready to review`,
    text: [
      `Hi ${firstName},`,
      "",
      `Your proposed meal plan "${proposal.title}" is ready. Open the link below to view it, remove anything you'd like to skip, leave a comment, and approve — no login needed:`,
      "",
      reviewUrl,
      "",
      `Thank you,`,
      kitchen.name,
    ].join("\n"),
  });

  revalidatePath(`/proposals/${proposal.id}`);
  return { ok: true };
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

/**
 * Fills in ingredients + steps for a recipe that currently only has a blurb,
 * using the existing description as context. Keeps the blurb (only writes the
 * description if there wasn't one).
 */
export async function generateRecipeDetailsAction(formData: FormData) {
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
    recipe.description || recipe.sourceDescription,
  );

  await prisma.recipe.update({
    where: { id: recipeId },
    data: {
      ingredientsText: result.ingredients,
      instructionsText: result.instructions,
      // Preserve the existing blurb; only set a description if it was empty.
      ...(recipe.description ? {} : { description: result.description }),
      detailStatus: RecipeDetailStatus.READY,
    },
  });

  revalidateApp();
  revalidatePath(`/recipes/${recipeId}`);
}

export async function generateNutritionAction(formData: FormData) {
  const recipeId = requiredText(formData, "recipeId");

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { title: true, ingredientsText: true, servings: true },
  });

  if (!recipe) {
    throw new Error("Recipe not found");
  }

  const nutrition = await generateRecipeNutrition(
    recipe.title,
    recipe.ingredientsText,
    recipe.servings,
  );

  await prisma.recipe.update({
    where: { id: recipeId },
    data: { nutrition: JSON.stringify(nutrition) },
  });

  revalidateApp();
  revalidatePath(`/recipes/${recipeId}`);
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

export async function updateInvoice(formData: FormData) {
  const invoiceId = requiredText(formData, "invoiceId");
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

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      clientId,
      invoiceDate,
      remarks,
      lineItems: {
        deleteMany: {},
        create: lineItems,
      },
    },
  });

  revalidateApp();
  redirect(`/invoices/${invoiceId}`);
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

const KEEP_SENTINEL = "__KEEP__";

interface CollectedArticle {
  title: string;
  body: string;
  imageData: string | null;
  imageRef: string | null; // existing article id when keeping the stored image
  position: number;
}

function collectArticles(formData: FormData): CollectedArticle[] {
  const titles = formData.getAll("articleTitle");
  const bodies = formData.getAll("articleBody");
  const images = formData.getAll("articleImage");
  const imageRefs = formData.getAll("articleImageRef");

  const articles: CollectedArticle[] = [];
  for (let i = 0; i < titles.length; i++) {
    const title = typeof titles[i] === "string" ? (titles[i] as string).trim() : "";
    const body = typeof bodies[i] === "string" ? (bodies[i] as string).trim() : "";
    const image = typeof images[i] === "string" ? (images[i] as string) : "";
    const ref = typeof imageRefs[i] === "string" ? (imageRefs[i] as string).trim() : "";
    if (!title && !body) continue;

    let imageData: string | null = null;
    let imageRef: string | null = null;
    if (image === KEEP_SENTINEL) {
      imageRef = ref || null;
    } else if (image) {
      imageData = image;
    }

    articles.push({
      title: title || "Untitled",
      body,
      imageData,
      imageRef,
      position: articles.length + 1,
    });
  }
  return articles;
}

export async function createNewsletter(formData: FormData) {
  const kitchen = await getKitchen();
  const title = requiredText(formData, "title");
  const intro = optionalText(formData, "intro");
  const introImageRaw = formData.get("introImage");
  const introImage =
    typeof introImageRaw === "string" && introImageRaw && introImageRaw !== KEEP_SENTINEL
      ? introImageRaw
      : null;
  const publishDateValue = optionalText(formData, "publishDate");
  const publishDate = publishDateValue ? parseDateInput(publishDateValue) : null;

  const articles = collectArticles(formData);
  if (articles.length === 0) {
    throw new Error("At least one article is required");
  }

  const newsletter = await prisma.newsletter.create({
    data: {
      kitchenId: kitchen.id,
      title,
      intro,
      introImage,
      publishDate,
      articles: {
        create: articles.map((a) => ({
          title: a.title,
          body: a.body,
          imageData: a.imageData,
          position: a.position,
        })),
      },
    },
  });

  revalidateApp();
  redirect(`/newsletters/${newsletter.id}`);
}

export async function updateNewsletter(formData: FormData) {
  const newsletterId = requiredText(formData, "newsletterId");
  const title = requiredText(formData, "title");
  const intro = optionalText(formData, "intro");
  const introImageRaw = formData.get("introImage");
  const publishDateValue = optionalText(formData, "publishDate");
  const publishDate = publishDateValue ? parseDateInput(publishDateValue) : null;

  const articles = collectArticles(formData);
  if (articles.length === 0) {
    throw new Error("At least one article is required");
  }

  // Pull existing record so we can merge KEEP-sentinel images without
  // requiring the client to re-upload them.
  const existing = await prisma.newsletter.findUnique({
    where: { id: newsletterId },
    include: { articles: { orderBy: { position: "asc" } } },
  });
  if (!existing) {
    throw new Error("Newsletter not found");
  }
  const existingArticlesById = new Map(
    existing.articles.map((a) => [a.id, a]),
  );

  let introImage: string | null;
  if (typeof introImageRaw !== "string") {
    introImage = null;
  } else if (introImageRaw === KEEP_SENTINEL) {
    introImage = existing.introImage;
  } else if (introImageRaw === "") {
    introImage = null;
  } else {
    introImage = introImageRaw;
  }

  const mergedArticles = articles.map((a) => {
    let imageData: string | null = a.imageData;
    if (a.imageData === null && a.imageRef) {
      imageData = existingArticlesById.get(a.imageRef)?.imageData ?? null;
    }
    return {
      title: a.title,
      body: a.body,
      imageData,
      position: a.position,
    };
  });

  await prisma.newsletter.update({
    where: { id: newsletterId },
    data: {
      title,
      intro,
      introImage,
      publishDate,
      articles: {
        deleteMany: {},
        create: mergedArticles,
      },
    },
  });

  revalidateApp();
  redirect(`/newsletters/${newsletterId}`);
}

export async function deleteNewsletter(formData: FormData) {
  const newsletterId = requiredText(formData, "newsletterId");
  await prisma.newsletter.delete({ where: { id: newsletterId } });
  revalidateApp();
}
