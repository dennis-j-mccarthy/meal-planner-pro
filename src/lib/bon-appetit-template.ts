import { readFileSync } from "fs";
import { join } from "path";

interface MenuRecipe {
  title: string;
  description: string | null;
  category: string | null;
  ingredientsText: string | null;
  instructionsText: string | null;
}

interface BonAppetitData {
  clientFirstNames: string;
  menuDate: string;
  recipes: MenuRecipe[];
  isCoaching: boolean;
}

function loadAssetBase64(relativePath: string, mime: string): string {
  const filePath = join(process.cwd(), "public", relativePath);
  const buffer = readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export function buildBonAppetitHtml(data: BonAppetitData): string {
  const logoSrc = loadAssetBase64("jwblogo600.png", "image/png");
  const outfit400 = loadAssetBase64("fonts/outfit-400.woff2", "font/woff2");
  const outfit600 = loadAssetBase64("fonts/outfit-600.woff2", "font/woff2");
  const outfit700 = loadAssetBase64("fonts/outfit-700.woff2", "font/woff2");
  const luckyFont = loadAssetBase64("fonts/lucky.ttf", "font/truetype");

  // Group recipes by category
  const grouped = new Map<string, MenuRecipe[]>();
  for (const recipe of data.recipes) {
    if (!recipe.category) {
      // No category — add recipe without a category header
      if (!grouped.has("")) grouped.set("", []);
      grouped.get("")!.push(recipe);
      continue;
    }
    const cat = recipe.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(recipe);
  }

  // Reorder categories so the menu reads in a natural meal flow:
  // breakfast → salads/soups → entrees/sides → other → desserts → "Gift from Beth"
  const sortedGrouped = new Map<string, MenuRecipe[]>(
    [...grouped.entries()].sort(
      ([a], [b]) => categoryRank(a) - categoryRank(b),
    ),
  );

  // Build recipe HTML blocks.
  // The category header is placed INSIDE the first recipe block of each category
  // so it never gets orphaned at the bottom of a column.
  // Subsequent recipes in the same category flow freely for better balancing.
  const recipeBlocks: string[] = [];
  for (const [category, recipes] of sortedGrouped) {
    for (let i = 0; i < recipes.length; i++) {
      const recipe = recipes[i];
      let blockHtml = `<div class="recipe-block">`;

      // Only the first recipe in a category gets the header (skip if no category)
      if (i === 0 && category) {
        blockHtml += `<div class="category-header">${escapeHtml(category)}</div>`;
      }

      blockHtml += `<div class="recipe-title">${escapeHtml(recipe.title)}</div>`;

      if (recipe.description) {
        blockHtml += `<div class="recipe-desc">${escapeHtml(recipe.description)}</div>`;
      }

      if (data.isCoaching) {
        if (recipe.ingredientsText) {
          blockHtml += `<div class="recipe-section-label">Ingredients</div>
            <div class="recipe-desc">${formatMultiline(recipe.ingredientsText)}</div>`;
        }
        if (recipe.instructionsText) {
          blockHtml += `<div class="recipe-section-label">Instructions</div>
            <div class="recipe-desc">${formatMultiline(recipe.instructionsText)}</div>`;
        }
      }

      blockHtml += `</div>`;
      recipeBlocks.push(blockHtml);
    }
  }

  const allRecipeContent = recipeBlocks.join("\n");

  const coachingSubtitle = data.isCoaching
    ? `<div class="coaching-subtitle">Culinary Coaching Session</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Outfit';
    font-weight: 400;
    font-style: normal;
    src: url('${outfit400}') format('woff2');
  }
  @font-face {
    font-family: 'Outfit';
    font-weight: 600;
    font-style: normal;
    src: url('${outfit600}') format('woff2');
  }
  @font-face {
    font-family: 'Outfit';
    font-weight: 700;
    font-style: normal;
    src: url('${outfit700}') format('woff2');
  }
  @font-face {
    font-family: 'Lucky Fellas';
    font-weight: 400;
    font-style: normal;
    src: url('${luckyFont}') format('truetype');
  }

  @page {
    size: letter;
    margin: 15px;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Outfit', sans-serif;
    font-size: 10px;
    color: #444;
    background: #ffffff;
    padding: 15px;
  }

  .page {
    padding: 20px 90px;
    min-height: calc(100vh - 30px);
    display: flex;
    flex-direction: column;
  }

  .page + .page {
    page-break-before: always;
  }

  .header {
    text-align: center;
    margin-bottom: 42px;
  }

  .logo-wrap {
    margin-bottom: 12px;
  }

  .logo-wrap img {
    max-width: 150px;
    height: auto;
  }

  .title {
    font-family: 'Lucky Fellas', cursive;
    font-size: 32px;
    color: #5B9BD5;
    line-height: 1.2;
  }

  .coaching-subtitle {
    font-family: 'Outfit', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #666;
    margin-top: 4px;
  }

  .date {
    font-size: 11px;
    color: #666;
    margin-bottom: 20px;
  }

  .columns {
    column-count: 2;
    column-gap: 25px;
    flex: 1;
  }

  .category-header {
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 12px;
    color: #000;
    margin-bottom: 8px;
  }

  .recipe-block {
    margin-bottom: 16px;
    break-inside: avoid;
  }

  .recipe-title {
    font-family: 'Outfit', sans-serif;
    font-weight: 700;
    font-size: 11px;
    color: #5B9BD5;
    line-height: 1.3;
  }

  .recipe-desc {
    font-size: 10px;
    color: #444;
    line-height: 1.5;
    margin-top: 2px;
  }

  .recipe-section-label {
    font-size: 10px;
    font-weight: 600;
    color: #333;
    margin-top: 6px;
    margin-bottom: 2px;
  }

  .signoff {
    margin-top: 25px;
    text-align: left;
    break-inside: avoid;
  }

  .signoff-message {
    font-family: 'Outfit', sans-serif;
    font-size: 11px;
    font-style: italic;
    color: #666;
  }

  .signoff-name {
    font-family: 'Lucky Fellas', cursive;
    font-size: 24px;
    color: #000;
    margin-top: 4px;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-wrap">
        <img src="${logoSrc}" alt="Joyful Wellness with Beth" />
      </div>
      <div class="title">Bon Appetit, ${escapeHtml(data.clientFirstNames)}!</div>
      ${coachingSubtitle}
      <div class="date">${escapeHtml(data.menuDate)}</div>
    </div>

    <div class="columns">
      ${allRecipeContent}

      <div class="signoff">
        <div class="signoff-message">To your health and happiness...</div>
        <div class="signoff-name">Chef Beth</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function categoryRank(category: string): number {
  const c = category.toLowerCase();
  if (!c) return 50;
  if (c.includes("breakfast") || c.includes("morning")) return 10;
  if (c.includes("smoothie") || c.includes("juice") || c.includes("drink")) return 15;
  if (c.includes("appetizer") || c.includes("snack")) return 20;
  if (c.includes("salad") || c.includes("soup")) return 30;
  if (c.includes("entree") || c.includes("entrée") || c.includes("side")) return 40;
  if (c.includes("dessert")) return 70;
  if (c.includes("gift from beth")) return 80;
  return 50;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMultiline(text: string): string {
  return text
    .split("\n")
    .map((line) => escapeHtml(line))
    .join("<br>");
}
