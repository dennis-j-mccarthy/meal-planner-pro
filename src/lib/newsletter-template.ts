import { readFileSync } from "fs";
import { join } from "path";

interface NewsletterArticleData {
  title: string;
  body: string;
  imageData: string | null;
}

interface NewsletterData {
  title: string;
  intro: string | null;
  publishDate: string | null;
  articles: NewsletterArticleData[];
}

function loadAssetBase64(relativePath: string, mime: string): string {
  const filePath = join(process.cwd(), "public", relativePath);
  const buffer = readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export function buildNewsletterHtml(data: NewsletterData): string {
  const logoSrc = loadAssetBase64("jwblogo600.png", "image/png");

  const introBlock = data.intro
    ? `
      <tr>
        <td style="padding:0 32px 24px 32px;font-family:'Outfit',Arial,sans-serif;font-size:15px;line-height:1.6;color:#444;">
          ${formatParagraphs(data.intro)}
        </td>
      </tr>`
    : "";

  const articleBlocks = data.articles
    .map(
      (a) => `
      <tr>
        <td style="padding:0 32px 28px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-family:'Outfit',Arial,sans-serif;font-size:20px;font-weight:700;color:#5B9BD5;padding-bottom:10px;">
                ${escapeHtml(a.title)}
              </td>
            </tr>
            ${
              a.imageData
                ? `<tr>
                    <td style="padding-bottom:12px;">
                      <img src="${a.imageData}" alt="${escapeHtml(a.title)}" style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;" />
                    </td>
                  </tr>`
                : ""
            }
            <tr>
              <td style="font-family:'Outfit',Arial,sans-serif;font-size:15px;line-height:1.6;color:#444;">
                ${formatParagraphs(a.body)}
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("");

  const dateLine = data.publishDate
    ? `<div style="font-family:'Outfit',Arial,sans-serif;font-size:12px;color:#888;margin-top:6px;">${escapeHtml(data.publishDate)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(data.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:'Outfit',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f4f0;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td align="center" style="padding:32px 32px 16px 32px;">
              <img src="${logoSrc}" alt="Joyful Wellness with Beth" style="display:block;max-width:150px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 28px 32px;">
              <div style="font-family:'Georgia',serif;font-style:italic;font-size:30px;line-height:1.2;color:#5B9BD5;">
                ${escapeHtml(data.title)}
              </div>
              ${dateLine}
            </td>
          </tr>
          ${introBlock}
          ${articleBlocks}
          <tr>
            <td style="padding:24px 32px 32px 32px;border-top:1px solid #eee;font-family:'Outfit',Arial,sans-serif;font-size:13px;color:#888;text-align:center;">
              To your health and happiness,<br>
              <span style="font-family:'Georgia',serif;font-style:italic;font-size:20px;color:#333;">Chef Beth</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 12px 0;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}
