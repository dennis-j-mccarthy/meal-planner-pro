import { NextRequest, NextResponse } from "next/server";
import { buildNewsletterHtml } from "@/lib/newsletter-template";

export async function POST(request: NextRequest) {
  const data = await request.json();
  const html = buildNewsletterHtml({
    title: typeof data.title === "string" ? data.title : "Untitled newsletter",
    intro: typeof data.intro === "string" && data.intro.trim() ? data.intro : null,
    introImage:
      typeof data.introImage === "string" && data.introImage
        ? data.introImage
        : null,
    publishDate:
      typeof data.publishDate === "string" && data.publishDate.trim()
        ? data.publishDate
        : null,
    articles: Array.isArray(data.articles)
      ? data.articles.map((a: { title?: unknown; body?: unknown; imageData?: unknown }) => ({
          title: typeof a.title === "string" ? a.title : "",
          body: typeof a.body === "string" ? a.body : "",
          imageData:
            typeof a.imageData === "string" && a.imageData ? a.imageData : null,
        }))
      : [],
  });
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
