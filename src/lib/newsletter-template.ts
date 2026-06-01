import {
  renderNewsletterHtml,
  type NewsletterData,
} from "./newsletter-render";

const LOGO_URL =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/jwblogo600.png`
    : "https://meal-planner-pro-puce.vercel.app/jwblogo600.png";

export function buildNewsletterHtml(data: NewsletterData): string {
  return renderNewsletterHtml(data, LOGO_URL);
}
