import Link from "next/link";
import { createMenuCard } from "@/app/actions";
import { BonAppetitRecipeEditor } from "@/components/bon-appetit-recipe-editor";
import { formatDateShort } from "@/lib/format";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function MenuCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; cookDateId?: string }>;
}) {
  const kitchen = await getKitchen();
  const params = await searchParams;
  const preselectedClientId = params.clientId || "";
  const preselectedCookDateId = params.cookDateId || "";

  const [clients, recipes, cookDates, menuCards] = await Promise.all([
    prisma.client.findMany({
      where: { kitchenId: kitchen.id, active: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.recipe.findMany({
      where: { kitchenId: kitchen.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, cuisine: true, description: true },
    }),
    prisma.cookDate.findMany({
      where: { kitchenId: kitchen.id },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { scheduledFor: "desc" },
    }),
    prisma.menuCard.findMany({
      where: { kitchenId: kitchen.id },
      include: {
        client: true,
        cookDate: true,
        recipes: {
          orderBy: { position: "asc" },
          include: { recipe: { select: { title: true } } },
        },
      },
      orderBy: { menuDate: "desc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Bon Appetit
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Create Bon Appetit menus and culinary coaching session documents.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        {/* Create form */}
        <form action={createMenuCard} className="panel p-6">
          <h2 className="text-lg font-bold text-slate-900">
            New Bon Appetit
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Pick a client, add recipes, and generate a branded PDF.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Client
              </label>
              <select className="field" name="clientId" required defaultValue={preselectedClientId}>
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.firstName} {client.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Cook date <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <select className="field" name="cookDateId" defaultValue={preselectedCookDateId}>
                <option value="">Ad-hoc (no cook date)</option>
                {cookDates.map((cd) => (
                  <option key={cd.id} value={cd.id}>
                    {formatDateShort(cd.scheduledFor)} — {cd.client.firstName} {cd.client.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Menu date
              </label>
              <input
                className="field"
                name="menuDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCoaching"
                name="isCoaching"
                className="h-4 w-4 rounded border-slate-300 text-[var(--accent)]"
              />
              <label
                htmlFor="isCoaching"
                className="text-sm font-medium text-slate-700"
              >
                Culinary coaching session
                <span className="ml-1 text-xs font-normal text-slate-400">
                  (includes full ingredients &amp; instructions)
                </span>
              </label>
            </div>

            <BonAppetitRecipeEditor recipes={recipes} />

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Notes{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                className="field min-h-16"
                name="notes"
                placeholder="Internal notes about this menu card"
              />
            </div>
          </div>

          <button className="button-primary mt-5 w-full" type="submit">
            Create Bon Appetit
          </button>
        </form>

        {/* List */}
        <div className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-900">
              All Bon Appetits
            </h2>
            <span className="text-sm text-slate-500">
              {menuCards.length} total
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {menuCards.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
                No Bon Appetits yet. Create your first one using the form.
              </div>
            ) : (
              menuCards.map((card) => (
                <Link
                  key={card.id}
                  href={`/menu-cards/${card.id}`}
                  className="block rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {card.title}
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {card.client.firstName} {card.client.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateShort(card.menuDate)}
                        {card.isCoaching && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                            Coaching
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-600">
                        {card.recipes.length} recipe
                        {card.recipes.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {card.recipes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {card.recipes.slice(0, 4).map((mr) => (
                        <span
                          key={mr.id}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {mr.recipe.title}
                        </span>
                      ))}
                      {card.recipes.length > 4 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          +{card.recipes.length - 4} more
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
