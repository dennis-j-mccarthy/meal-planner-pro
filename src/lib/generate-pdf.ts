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

    // Align tops of column 1 and column 2:
    // - if both start with a category-header, align the headers
    // - if col 1 has a header and col 2 starts with a recipe, align the
    //   blue recipe titles (push col 2 down by header height)
    // - if neither has a header, they already align — no-op
    // We measure actual rendered offsets and adjust margin-top, then re-check
    // to absorb reflow.
    for (let pass = 0; pass < 3; pass++) {
      const adjusted = await page.evaluate(() => {
        const blocks = Array.from(
          document.querySelectorAll<HTMLElement>(".columns .recipe-block"),
        );
        if (blocks.length === 0) return false;

        const firstLeft = blocks[0].offsetLeft;
        const col1First = blocks[0];
        const col2First = blocks.find((b) => b.offsetLeft > firstLeft + 1);
        if (!col2First) return false;

        // Pick the alignment target inside each column.
        // If the block starts with .category-header, we align using that
        // header. Otherwise we align using the first .recipe-title.
        function targetTop(block: HTMLElement): number | null {
          const header = block.querySelector<HTMLElement>(
            ":scope > .category-header",
          );
          const title = block.querySelector<HTMLElement>(
            ":scope > .recipe-title",
          );
          // Mixed case: col 1 has header + title, col 2 has only title.
          // We want to align the *visible* first heading on each side.
          // For the *col-1-with-header / col-2-without-header* case we use
          // the recipe-title in col 1 (the blue subhead) so it aligns with
          // col 2's title — but we only do that when col 2 has no header.
          // The caller decides which target to use; here we just return
          // both rects.
          const t = title?.getBoundingClientRect().top;
          const h = header?.getBoundingClientRect().top;
          if (h !== undefined) return h;
          if (t !== undefined) return t;
          return null;
        }

        const col1HasHeader = !!col1First.querySelector<HTMLElement>(
          ":scope > .category-header",
        );
        const col2HasHeader = !!col2First.querySelector<HTMLElement>(
          ":scope > .category-header",
        );

        let delta: number;
        if (col1HasHeader && col2HasHeader) {
          // Header-to-header alignment.
          const a = targetTop(col1First);
          const b = targetTop(col2First);
          if (a == null || b == null) return false;
          delta = a - b;
        } else if (col1HasHeader && !col2HasHeader) {
          // Align col-1 recipe-title with col-2 recipe-title.
          const t1 = col1First
            .querySelector<HTMLElement>(":scope > .recipe-title")
            ?.getBoundingClientRect().top;
          const t2 = col2First
            .querySelector<HTMLElement>(":scope > .recipe-title")
            ?.getBoundingClientRect().top;
          if (t1 == null || t2 == null) return false;
          delta = t1 - t2;
        } else if (!col1HasHeader && col2HasHeader) {
          // Rare: col 2 has a header but col 1 doesn't. Align headers
          // by pushing col 1's title down. We pad col 1.
          const t1 = col1First
            .querySelector<HTMLElement>(":scope > .recipe-title")
            ?.getBoundingClientRect().top;
          const h2 = col2First
            .querySelector<HTMLElement>(":scope > .category-header")
            ?.getBoundingClientRect().top;
          if (t1 == null || h2 == null) return false;
          // Negative delta means col 1's title is above col 2's header —
          // we'd want to push col 1 down. Only act if col 1 is higher.
          const colDelta = h2 - t1;
          if (colDelta > 0.5) {
            col1First.style.marginTop = `${Math.round(colDelta)}px`;
            return true;
          }
          return false;
        } else {
          // Neither has a header — already aligned by default.
          return false;
        }

        if (delta > 0.5) {
          // Round only at the end; preserve sub-pixel intent over passes.
          const existing = parseFloat(col2First.style.marginTop) || 0;
          col2First.style.marginTop = `${Math.round(existing + delta)}px`;
          return true;
        }
        return false;
      });

      if (!adjusted) break;
    }

    const pdf = await page.pdf({ format: "Letter", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
