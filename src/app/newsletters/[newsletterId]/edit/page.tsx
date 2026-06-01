import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getKitchen } from "@/lib/data";
import { NewsletterComposer } from "@/components/newsletter-composer";

export default async function NewsletterEditPage({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/newsletters" className="hover:text-slate-900">
          Newsletters
        </Link>
        <span>/</span>
        <Link
          href={`/newsletters/${newsletter.id}`}
          className="hover:text-slate-900 truncate"
        >
          {newsletter.title}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Edit</span>
      </div>

      <NewsletterComposer
        initial={{
          id: newsletter.id,
          title: newsletter.title,
          intro: newsletter.intro ?? "",
          publishDate: newsletter.publishDate
            ? newsletter.publishDate.toISOString().slice(0, 10)
            : "",
          articles: newsletter.articles.map((a) => ({
            title: a.title,
            body: a.body,
            imageData: a.imageData,
          })),
        }}
      />
    </div>
  );
}
