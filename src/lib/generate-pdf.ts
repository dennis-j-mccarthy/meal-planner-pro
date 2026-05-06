// Supports both local dev (full puppeteer) and serverless (Vercel) via puppeteer-core + @sparticuz/chromium-min
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

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const browser = await getBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Align column 2's first blue recipe title with column 1's first blue
    // recipe title. When col 1 has a category header but col 2 doesn't, we
    // insert an invisible clone of col 1's category header at the top of
    // col 2's first block — this guarantees the column flow gives both
    // titles the same vertical offset, regardless of how many lines the
    // titles wrap to.
    for (let pass = 0; pass < 4; pass++) {
      const adjusted = await page.evaluate(() => {
        const blocks = Array.from(
          document.querySelectorAll<HTMLElement>(".columns .recipe-block"),
        );
        if (blocks.length === 0) return false;

        const firstLeft = blocks[0].offsetLeft;
        const col1First = blocks[0];
        const col2First = blocks.find((b) => b.offsetLeft > firstLeft + 1);
        if (!col2First) return false;

        const col1Header = col1First.querySelector<HTMLElement>(
          ":scope > .category-header",
        );
        const col2Header = col2First.querySelector<HTMLElement>(
          ":scope > .category-header",
        );

        // Only the mixed case needs adjustment. Header/header and
        // recipe/recipe both naturally align at the column tops.
        if (!col1Header || col2Header) return false;

        // Already adjusted on a previous pass? Skip.
        if (col2First.querySelector(":scope > .category-header-spacer")) {
          return false;
        }

        // Insert an invisible clone of the col-1 category header so the
        // column flow treats both columns identically.
        const spacer = col1Header.cloneNode(true) as HTMLElement;
        spacer.classList.add("category-header-spacer");
        spacer.style.visibility = "hidden";
        col2First.insertBefore(spacer, col2First.firstChild);
        return true;
      });

      if (!adjusted) break;
    }

    const pdf = await page.pdf({ format: "Letter", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
