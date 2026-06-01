import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getKitchen } from "@/lib/data";
import { formatDateShort } from "@/lib/format";
import { deleteNewsletter } from "@/app/actions";

export default async function NewslettersPage() {
  const kitchen = await getKitchen();
  const newsletters = await prisma.newsletter.findMany({
    where: { kitchenId: kitchen.id },
    include: { articles: { select: { id: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Newsletters</h1>
          <p className="mt-1 text-sm text-slate-500">
            Compose branded email newsletters with an intro and articles.
          </p>
        </div>
        <Link href="/newsletters/new" className="button-primary text-sm">
          + New newsletter
        </Link>
      </div>

      {newsletters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
          No newsletters yet. Start with the button above.
        </div>
      ) : (
        <div className="grid gap-3">
          {newsletters.map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-5 py-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <Link
                href={`/newsletters/${n.id}`}
                className="min-w-0 flex-1"
              >
                <p className="font-semibold text-slate-900 truncate">
                  {n.title}
                </p>
                <p className="text-xs text-slate-500">
                  {n.publishDate ? formatDateShort(n.publishDate) : "No publish date"}
                  {" · "}
                  {n.articles.length} {n.articles.length === 1 ? "article" : "articles"}
                </p>
              </Link>
              <form action={deleteNewsletter}>
                <input type="hidden" name="newsletterId" value={n.id} />
                <button
                  type="submit"
                  className="rounded p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50"
                  title="Delete"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
