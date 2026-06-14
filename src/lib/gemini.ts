import { put } from "@vercel/blob";

const API_KEY = process.env.GEMINI_API_KEY;

const FOODISH_CATEGORIES = [
  "biryani", "burger", "butter-chicken", "dessert", "dosa", "idly",
  "pasta", "pizza", "rice", "samosa",
];

function matchFoodishCategory(title: string, cuisine?: string | null): string {
  const text = `${title} ${cuisine || ""}`.toLowerCase();
  if (text.includes("pasta") || text.includes("spaghetti") || text.includes("penne") || text.includes("lasagna")) return "pasta";
  if (text.includes("pizza")) return "pizza";
  if (text.includes("burger")) return "burger";
  if (text.includes("biryani")) return "biryani";
  if (text.includes("butter chicken") || text.includes("tikka")) return "butter-chicken";
  if (text.includes("rice") || text.includes("risotto") || text.includes("pilaf")) return "rice";
  if (text.includes("dessert") || text.includes("cake") || text.includes("cookie") || text.includes("brownie") || text.includes("tart")) return "dessert";
  if (text.includes("dosa") || text.includes("crepe")) return "dosa";
  if (text.includes("samosa")) return "samosa";
  // Default to a random category
  return FOODISH_CATEGORIES[Math.floor(Math.random() * FOODISH_CATEGORIES.length)];
}

async function generateWithGemini(
  title: string,
  description?: string | null,
  cuisine?: string | null,
): Promise<Buffer> {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const prompt = [
    "Generate a beautiful, appetizing, professional food photograph of this dish.",
    "Square 1:1 aspect ratio. Overhead angle, natural lighting, clean white plate, styled for a high-end personal chef portfolio.",
    "No text, no watermarks, no labels.",
    "",
    `Dish: ${title}`,
    cuisine ? `Cuisine: ${cuisine}` : "",
    description ? `Description: ${description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find(
    (p: { inlineData?: { data: string } }) => p.inlineData,
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error("No image returned from Gemini");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function generateWithFoodish(
  title: string,
  cuisine?: string | null,
): Promise<Buffer> {
  const category = matchFoodishCategory(title, cuisine);
  const metaResponse = await fetch(`https://foodish-api.com/api/images/${category}`);

  if (!metaResponse.ok) {
    throw new Error(`Foodish API error: ${metaResponse.status}`);
  }

  const meta = await metaResponse.json() as { image: string };
  const imageResponse = await fetch(meta.image);

  if (!imageResponse.ok) {
    throw new Error(`Failed to download Foodish image: ${imageResponse.status}`);
  }

  return Buffer.from(await imageResponse.arrayBuffer());
}

export async function generateRecipeImage(
  title: string,
  description?: string | null,
  cuisine?: string | null,
): Promise<string> {
  let buffer: Buffer;

  try {
    buffer = await generateWithGemini(title, description, cuisine);
  } catch {
    // Fallback to Foodish stock photos
    buffer = await generateWithFoodish(title, cuisine);
  }

  // Store in Vercel Blob (serverless filesystem is read-only on Vercel).
  const blob = await put("recipes/generated/dish.jpg", buffer, {
    access: "public",
    contentType: "image/jpeg",
    addRandomSuffix: true,
  });

  return blob.url;
}

type RecipeTextResult = {
  description: string;
  ingredients: string;
  instructions: string;
};

export type ExtractedRecipe = {
  title: string;
  description: string;
  cuisine: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string | null;
  ingredients: string;
  instructions: string;
};

function coerceNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function coerceText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reads a photo or screenshot of a recipe (e.g. a cookbook page) and extracts
 * structured recipe content using Gemini's vision model.
 */
export async function extractRecipeFromImage(
  base64Data: string,
  mimeType: string,
): Promise<ExtractedRecipe> {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const prompt = [
    "You are a professional chef digitizing recipes for a meal-planning app.",
    "The attached image is a photo or screenshot of a recipe — likely a cookbook page, a printout, a handwritten card, or a screen capture.",
    "Read ALL the text in the image (OCR) and extract the recipe faithfully. Do not invent ingredients or steps that are not present, but you may lightly clean up obvious OCR errors and formatting.",
    "Preserve exact quantities, measurements, temperatures, and times as written.",
    "",
    "Return ONLY valid JSON with exactly these fields:",
    "{",
    '  "isRecipe": true/false — false only if the image clearly contains no recipe at all,',
    '  "title": "The recipe name. If none is visible, write a short descriptive title.",',
    '  "description": "A 1-2 sentence appetizing summary of the dish. Write one if the source has none.",',
    '  "cuisine": "Cuisine if identifiable, else null",',
    '  "servings": number of servings/yield as an integer, or null,',
    '  "prepMinutes": prep time in minutes as an integer, or null,',
    '  "cookMinutes": cook time in minutes as an integer, or null,',
    '  "tags": "comma-separated descriptive tags (e.g. dinner, vegetarian, one-pot), or null",',
    '  "ingredients": "One ingredient per line, with quantities. Use \\n between lines.",',
    '  "instructions": "Numbered steps, one per line. Use \\n between lines."',
    "}",
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text returned from Gemini");
  }

  const parsed = JSON.parse(text);

  if (parsed.isRecipe === false) {
    throw new Error("No recipe could be found in that image. Try a clearer photo.");
  }

  const title = coerceText(parsed.title);
  const ingredients = coerceText(parsed.ingredients);
  const instructions = coerceText(parsed.instructions);

  if (!title || (!ingredients && !instructions)) {
    throw new Error("Couldn't read a recipe from that image. Try a clearer, well-lit photo.");
  }

  return {
    title,
    description: coerceText(parsed.description) ?? "",
    cuisine: coerceText(parsed.cuisine),
    servings: coerceNumber(parsed.servings),
    prepMinutes: coerceNumber(parsed.prepMinutes),
    cookMinutes: coerceNumber(parsed.cookMinutes),
    tags: coerceText(parsed.tags),
    ingredients: ingredients ?? "",
    instructions: instructions ?? "",
  };
}

export async function generateRecipeText(
  title: string,
  cuisine?: string | null,
  tags?: string | null,
  dietaryFlags?: string | null,
  servings?: number | null,
  sourceDescription?: string | null,
): Promise<RecipeTextResult> {
  if (!API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const prompt = [
    "You are a professional personal chef writing recipe content for a client-facing meal planning app.",
    "Write realistic, specific, professional recipe content for this dish. Do NOT reference any PDF, import, or source document.",
    "",
    `Recipe: ${title}`,
    cuisine ? `Cuisine: ${cuisine}` : "",
    tags ? `Tags: ${tags}` : "",
    dietaryFlags ? `Dietary: ${dietaryFlags}` : "",
    servings ? `Serves: ${servings}` : "",
    sourceDescription && !sourceDescription.includes("imported") ? `Context: ${sourceDescription}` : "",
    "",
    "Return ONLY valid JSON with exactly these three fields:",
    '{',
    '  "description": "A 1-2 sentence appetizing summary of the dish for the client. Professional, warm tone.",',
    '  "ingredients": "One ingredient per line with quantities. Example:\\n2 lbs chicken thighs, bone-in\\n3 tbsp olive oil\\n4 cloves garlic, minced",',
    '  "instructions": "Numbered steps, one per line. Specific temperatures, times, and techniques. Example:\\n1. Preheat oven to 425°F.\\n2. Season chicken with salt and pepper.\\n3. Sear skin-side down in a hot skillet for 5 minutes."',
    '}',
    "",
    "Be specific with quantities, temperatures, and timing. Write as a professional chef would.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No text returned from Gemini");
  }

  const parsed = JSON.parse(text) as RecipeTextResult;

  if (!parsed.description || !parsed.ingredients || !parsed.instructions) {
    throw new Error("Incomplete recipe text returned from Gemini");
  }

  return parsed;
}
