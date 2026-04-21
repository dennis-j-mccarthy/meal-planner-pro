import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

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

  const imageDir = join(process.cwd(), "public", "recipe-images");
  await mkdir(imageDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const filePath = join(imageDir, filename);
  await writeFile(filePath, buffer);

  return `/recipe-images/${filename}`;
}

type RecipeTextResult = {
  description: string;
  ingredients: string;
  instructions: string;
};

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
