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

    // If column 2 starts mid-category (no header at top), align its first
    // recipe-title vertically with column 1's first recipe-title by adding
    // top margin equal to column 1's category-header height.
    await page.evaluate(() => {
      const blocks = Array.from(
        document.querySelectorAll<HTMLElement>(".columns .recipe-block"),
      );
      if (blocks.length === 0) return;

      const firstLeft = blocks[0].offsetLeft;
      const col2First = blocks.find((b) => b.offsetLeft > firstLeft + 1);
      if (!col2First) return;

      const startsWithHeader = col2First.firstElementChild?.classList.contains(
        "category-header",
      );
      if (startsWithHeader) return;

      // Find the first recipe-title in column 1 and column 2.
      const col1Title = blocks[0].querySelector<HTMLElement>(".recipe-title");
      const col2Title = col2First.querySelector<HTMLElement>(".recipe-title");
      if (!col1Title || !col2Title) return;

      const delta =
        col1Title.getBoundingClientRect().top -
        col2Title.getBoundingClientRect().top;
      if (delta > 0) {
        col2First.style.marginTop = `${Math.round(delta)}px`;
      }
    });

    const pdf = await page.pdf({ format: "Letter", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
