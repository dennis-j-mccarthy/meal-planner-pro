import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDateShort } from "@/lib/format";
import { MenuCardActions } from "@/components/menu-card-actions";

export default async function MenuCardDetailPage({
  params,
}: {
  params: Promise<{ menuCardId: string }>;
}) {
  const { menuCardId } = await params;

  const menuCard = await prisma.menuCard.findUnique({
    where: { id: menuCardId },
    include: {
      client: true,
      cookDate: true,
      recipes: {
        orderBy: { position: "asc" },
        include: { recipe: true },
      },
    },
  });

  if (!menuCard) notFound();

  // Group recipes by category for display
  const grouped = new Map<string, typeof menuCard.recipes>();
  for (const mr of menuCard.recipes) {
    const cat = mr.category || "";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(mr);
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/clients" className="hover:text-slate-900">
          Clients
        </Link>
        <span>/</span>
        <Link href={`/clients/${menuCard.client.id}`} className="hover:text-slate-900">
          {menuCard.client.firstName} {menuCard.client.lastName}
        </Link>
        {menuCard.cookDate && (
          <>
            <span>/</span>
            <Link href={`/cook-dates/${menuCard.cookDate.id}`} className="hover:text-slate-900">
              {formatDateShort(menuCard.cookDate.scheduledFor)}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-900 font-medium">Bon Appetit</span>
      </div>

      {/* Header */}
      <div className="panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">
                {menuCard.title}
              </h1>
              {menuCard.isCoaching && (
                <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                  Coaching Session
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {menuCard.client.firstName} {menuCard.client.lastName}
              {menuCard.client.address && (
                <span className="ml-2 text-slate-400">
                  &middot; {menuCard.client.address.split("\n")[0]}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatDateShort(menuCard.menuDate)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-slate-900">
              {menuCard.recipes.length} recipe
              {menuCard.recipes.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-5">
          <MenuCardActions menuCardId={menuCard.id} accepted={menuCard.accepted} />
        </div>
      </div>

      {/* Recipes grouped by category */}
      <div className="panel p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Menu</h2>

        <div className="space-y-6">
          {[...grouped.entries()].map(([category, recipes]) => (
            <div key={category || "_none"}>
              {category && (
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {category}
                </h3>
              )}
              <div className="space-y-3">
                {recipes.map((mr) => (
                  <div
                    key={mr.id}
                    className="rounded-lg border border-slate-100 p-4"
                  >
                    <h4 className="font-semibold text-[#5B9BD5]">
                      {mr.recipe.title}
                    </h4>
                    {mr.recipe.description && (
                      <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                        {mr.recipe.description}
                      </p>
                    )}
                    {menuCard.isCoaching && mr.recipe.ingredientsText && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Ingredients
                        </p>
                        <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                          {mr.recipe.ingredientsText}
                        </p>
                      </div>
                    )}
                    {menuCard.isCoaching && mr.recipe.instructionsText && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Instructions
                        </p>
                        <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                          {mr.recipe.instructionsText}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {menuCard.notes && (
        <div className="panel p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-2">Notes</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {menuCard.notes}
          </p>
        </div>
      )}
    </div>
  );
}
