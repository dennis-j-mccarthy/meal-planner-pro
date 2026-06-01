export interface NewsletterArticleData {
  title: string;
  body: string;
  imageData: string | null;
}

export interface NewsletterData {
  title: string;
  intro: string | null;
  introImage: string | null;
  publishDate: string | null;
  articles: NewsletterArticleData[];
}

export function renderNewsletterHtml(
  data: NewsletterData,
  logoSrc: string,
): string {
  const introImageBlock = data.introImage
    ? `
      <tr>
        <td style="padding:0 32px 16px 32px;">
          <img src="${data.introImage}" alt="" style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;" />
        </td>
      </tr>`
    : "";

  const introBlock = data.intro
    ? `
      <tr>
        <td class="nl-body" style="padding:0 32px 24px 32px;font-family:Verdana,Geneva,sans-serif;font-size:15px;line-height:1.6;color:#444;">
          ${renderRichBody(data.intro)}
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
              <td>
                <hr style="border:0;border-top:1px solid #e5e5e5;margin:0;" />
              </td>
            </tr>
            <tr>
              <td style="font-family:'Georgia',serif;font-size:24px;font-weight:400;color:#5B9BD5;padding-top:20px;padding-bottom:20px;line-height:1.25;">
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
              <td class="nl-body" style="font-family:Verdana,Geneva,sans-serif;font-size:15px;line-height:1.6;color:#444;">
                ${renderRichBody(a.body)}
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("");

  const dateLine = data.publishDate
    ? `<div style="font-family:Verdana,Geneva,sans-serif;font-size:12px;color:#888;margin-top:6px;">${escapeHtml(data.publishDate)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(data.title)}</title>
<style>
  .nl-body p { margin: 0 0 12px 0; }
  .nl-body h2 { font-size: 18px; font-weight: 700; color: #333; margin: 18px 0 8px 0; }
  .nl-body h3 { font-size: 16px; font-weight: 600; color: #333; margin: 16px 0 6px 0; }
  .nl-body ul, .nl-body ol { margin: 0 0 12px 0; padding-left: 22px; }
  .nl-body li { margin: 4px 0; }
  .nl-body blockquote { border-left: 3px solid #5B9BD5; padding-left: 12px; margin: 12px 0; color: #666; font-style: italic; }
  .nl-body a { color: #5B9BD5; text-decoration: underline; }
  .nl-body img { display: block; max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0; }
  .nl-body strong { font-weight: 700; }
  .nl-body em { font-style: italic; }
</style>
</head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:Verdana,Geneva,sans-serif;">
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
              <div style="font-family:'Georgia',serif;font-size:30px;line-height:1.2;color:#5B9BD5;">
                ${escapeHtml(data.title)}
              </div>
              ${dateLine}
            </td>
          </tr>
          ${introImageBlock}
          ${introBlock}
          ${articleBlocks}
          <tr>
            <td style="padding:24px 32px 32px 32px;border-top:1px solid #e5e5e5;font-family:Verdana,Geneva,sans-serif;font-size:15px;line-height:1.6;color:#444;">
              <img
                src="https://q35qgefmldvolfk0.public.blob.vercel-storage.com/newsletters/kitchen_jwb/beth-chef-coat-l0E6L8O6eBC0suT2rZJHmGoltiZ0Dt.png"
                alt="Chef Beth"
                width="180"
                style="float:right;width:180px;height:auto;margin-left:20px;margin-bottom:8px;border-radius:8px;"
              />
              <p style="margin:0 0 12px 0;">For more information, and to book your summer gathering, be in touch!</p>
              <p style="margin:0 0 12px 0;">719-440-2815</p>
              <p style="margin:0 0 12px 0;"><a href="mailto:Yogabeth@mac.com" style="color:#5B9BD5;text-decoration:underline;">Yogabeth@mac.com</a></p>
              <p style="margin:0 0 12px 0;"><a href="https://floridahealthychef.com" style="color:#5B9BD5;text-decoration:underline;">floridahealthychef.com</a></p>
              <p style="margin:0 0 12px 0;">Have a beautiful summer, dear friends. May you find moments to slow down, savor the simple joys of the season, and delight in the stillness, birdsong, and beauty that surrounds you.</p>
              <p style="margin:0 0 12px 0;">With love and gratitude,</p>
              <p style="margin:0;">Beth</p>
              <div style="clear:both;"></div>
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

/**
 * Article body can be either plain text (legacy / pre-rich-editor) or
 * rich HTML from Tiptap. Detect by looking for block-level tags.
 */
/**
 * Body text can be either plain text (legacy / pre-rich-editor) or
 * rich HTML from Tiptap. Detect by looking for block-level tags.
 */
function renderRichBody(body: string): string {
  const looksLikeHtml = /<(p|h[1-6]|ul|ol|li|blockquote|br|img|strong|em|a)\b/i.test(
    body,
  );
  return looksLikeHtml ? body : formatParagraphs(body);
}
