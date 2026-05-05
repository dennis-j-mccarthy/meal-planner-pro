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

    // If the first block of column 2 is a recipe (not a category header),
    // nudge it down so its title aligns vertically with the column-1 category header.
    await page.evaluate(() => {
      const columns = document.querySelector(".columns") as HTMLElement | null;
      const blocks = Array.from(
        document.querySelectorAll<HTMLElement>(".columns .recipe-block"),
      );
      if (!columns || blocks.length === 0) return;

      const firstLeft = blocks[0].offsetLeft;
      const col2First = blocks.find((b) => b.offsetLeft > firstLeft + 1);
      if (!col2First) return;

      const startsWithHeader = col2First.firstElementChild?.classList.contains(
        "category-header",
      );
      if (!startsWithHeader) {
        col2First.style.marginTop = "28px";
      }
    });

    const pdf = await page.pdf({ format: "Letter", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
