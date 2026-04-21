// Shared recipe scraper — renders a URL with Puppeteer and extracts JSON-LD Recipe data
/* eslint-disable @typescript-eslint/no-explicit-any */

const CHROMIUM_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

async function getBrowser(): Promise<any> {
  const isServerless =
    !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;

    return await puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_URL),
      headless: true,
    });
  }

  const puppeteer = (await import("puppeteer")).default;
  return await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export interface ScrapedRecipe {
  name?: string;
  description?: string;
  image?: string | { url?: string } | Array<string | { url?: string }>;
  recipeIngredient?: string[];
  recipeInstructions?: Array<string | { text?: string }>;
  prepTime?: string;
  cookTime?: string;
  recipeYield?: string | string[];
  recipeCuisine?: string | string[];
}

export async function scrapeRecipeFromUrl(sourceUrl: string): Promise<ScrapedRecipe | null> {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    await page.goto(sourceUrl, { waitUntil: "networkidle2", timeout: 15000 });

    const extracted = await page.evaluate(() => {
      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]',
      );
      for (const script of scripts) {
        try {
          const parsed = JSON.parse(script.textContent || "");
          const find = (
            obj: Record<string, unknown>,
          ): Record<string, unknown> | null => {
            if (obj["@type"] === "Recipe") return obj;
            if (Array.isArray(obj)) {
              for (const item of obj) {
                const found = find(item);
                if (found) return found;
              }
            }
            if (obj["@graph"] && Array.isArray(obj["@graph"])) {
              for (const item of obj["@graph"]) {
                const found = find(item);
                if (found) return found;
              }
            }
            return null;
          };
          const recipe = find(parsed);
          if (recipe) return recipe;
        } catch {
          /* skip */
        }
      }

      // Fallback: gather what we can from meta tags
      const getMetaContent = (name: string) =>
        document
          .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
          ?.getAttribute("content") || null;

      return {
        "@type": "Fallback" as const,
        name: document.title?.replace(/\s*[-|–—].*$/, "") || null,
        description:
          getMetaContent("og:description") || getMetaContent("description"),
        image: getMetaContent("og:image"),
      };
    });

    return extracted as ScrapedRecipe | null;
  } catch {
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

export function parseDuration(dur: string | undefined): number | null {
  if (!dur || typeof dur !== "string") return null;
  const h = dur.match(/(\d+)H/i);
  const m = dur.match(/(\d+)M/i);
  const total = (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  return total > 0 ? total : null;
}

export function extractImageUrl(image: ScrapedRecipe["image"]): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    return first?.url ?? null;
  }
  return image?.url ?? null;
}
