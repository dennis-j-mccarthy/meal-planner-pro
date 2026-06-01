import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getKitchen } from "@/lib/data";
import { formatDateShort } from "@/lib/format";
import { buildNewsletterHtml } from "@/lib/newsletter-template";
import { NewsletterPreview } from "@/components/newsletter-preview";

export default async function NewsletterDetailPage({
  params,
}: {
  params: Promise<{ newsletterId: string }>;
}) {
  const { newsletterId } = await params;
  const kitchen = await getKitchen();

  const newsletter = await prisma.newsletter.findFirst({
    where: { id: newsletterId, kitchenId: kitchen.id },
    include: { articles: { orderBy: { position: "asc" } } },
  });

  if (!newsletter) notFound();

  const html = buildNewsletterHtml({
    title: newsletter.title,
    intro: newsletter.intro,
    introImage: newsletter.introImage,
    publishDate: newsletter.publishDate
      ? formatDateShort(newsletter.publishDate)
      : null,
    articles: newsletter.articles.map((a) => ({
      title: a.title,
      body: a.body,
      imageData: a.imageData,
    })),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/newsletters" className="hover:text-slate-900">
          Newsletters
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium truncate">
          {newsletter.title}
        </span>
      </div>

      <div className="panel p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{newsletter.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {newsletter.publishDate
              ? formatDateShort(newsletter.publishDate)
              : "No publish date"}
            {" · "}
            {newsletter.articles.length}{" "}
            {newsletter.articles.length === 1 ? "article" : "articles"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/newsletters/${newsletter.id}/edit`}
            className="button-secondary text-sm"
          >
            Edit
          </Link>
          <NewsletterPreview html={html} />
        </div>
      </div>

      <div className="panel p-3">
        <iframe
          title="Newsletter"
          srcDoc={html}
          className="w-full h-[78vh] rounded-lg border border-slate-200 bg-white"
        />
      </div>
    </div>
  );
}
