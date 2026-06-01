import { readFileSync } from "fs";
import { join } from "path";
import {
  renderNewsletterHtml,
  type NewsletterData,
} from "./newsletter-render";

function loadAssetBase64(relativePath: string, mime: string): string {
  const filePath = join(process.cwd(), "public", relativePath);
  const buffer = readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export function buildNewsletterHtml(data: NewsletterData): string {
  const logoSrc = loadAssetBase64("jwblogo600.png", "image/png");
  return renderNewsletterHtml(data, logoSrc);
}
