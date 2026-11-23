import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { GroceryChecklist, GroceryPrintStyles } from "@/components/grocery-checklist";
import { buildGroceryList, toChecklist } from "@/lib/grocery";
import { requireKitchen } from "@/lib/guard";

// Filling missing ingredients (AI) can take a while on first open.
export const maxDuration = 60;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function CookDateGroceriesPage({
  params,
}: {
  params: Promise<{ cookDateId: string }>;
}) {
  const { cookDateId } = await params;
  const kitchen = await requireKitchen();

  const list = await buildGroceryList(cookDateId, kitchen.id);
  if (!list || list.cookDates.length === 0) notFound();
  const cd = list.cookDates[0];

  const title = `Groceries · ${format(cd.scheduledFor, "EEEE, MMMM d")}`;
  const subtitle = [
    cd.clientName,
    plural(cd.dishCount, "dish", "dishes"),
    cd.guests ? plural(cd.guests, "guest", "guests") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const { groups, copyText } = toChecklist(list, "cookDate", `${title}\n${subtitle}`);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <GroceryPrintStyles />
      <div className="no-print">
        <Link
          href={`/cook-dates/${cookDateId}`}
          className="inline-flex min-h-11 items-center text-base font-medium text-stone-500 hover:text-stone-700"
        >
          &larr; Back to cook date
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        <p className="text-base text-stone-500">{subtitle}</p>
      </div>

      {!cd.hasMenu ? (
        <div className="rounded-2xl border border-[#e7e5e4] bg-stone-50 px-5 py-8 text-center text-base text-stone-500">
          Groceries appear once the menu is accepted.
        </div>
      ) : (
        <>
          {list.missing.length > 0 && (
            <p className="no-print rounded-xl border border-[#e7e5e4] bg-white px-4 py-3 text-base text-stone-600">
              No ingredients yet for {list.missing.join(", ")}. Reload in a minute to try again.
            </p>
          )}
          {groups.length > 0 && (
            <GroceryChecklist
              mode="cookDate"
              cookDateId={cookDateId}
              groups={groups}
              initialChecked={list.checked}
              copyText={copyText}
            />
          )}
        </>
      )}
    </div>
  );
}
