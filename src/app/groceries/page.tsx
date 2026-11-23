import Link from "next/link";
import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import { GroceryChecklist, GroceryPrintStyles } from "@/components/grocery-checklist";
import { buildWeeklyGroceryList, toChecklist } from "@/lib/grocery";
import { requireKitchen } from "@/lib/guard";

// Filling missing ingredients (AI) can take a while on first open.
export const maxDuration = 60;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function WeeklyGroceriesPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const kitchen = await requireKitchen();
  const { week } = await searchParams;

  // Weeks run Monday → Sunday; ?week=YYYY-MM-DD picks the week containing it.
  const picked = week ? parseISO(week) : new Date();
  const start = startOfWeek(isValid(picked) ? picked : new Date(), { weekStartsOn: 1 });
  const end = addDays(start, 7);
  const weekParam = (d: Date) => format(d, "yyyy-MM-dd");

  const list = await buildWeeklyGroceryList(start, end, kitchen.id);
  const withMenu = list.cookDates.filter((cd) => cd.hasMenu);
  const clients = [...new Set(withMenu.map((cd) => cd.clientName))];

  const title = `Groceries · Week of ${format(start, "EEEE, MMMM d")}`;
  const subtitle = [
    plural(withMenu.length, "cook date", "cook dates"),
    plural(list.dishCount, "dish", "dishes"),
    clients.length > 0 ? clients.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const { groups, copyText } = toChecklist(list, "week", `${title}\n${subtitle}`);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <GroceryPrintStyles />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{title}</h1>
        <p className="text-base text-stone-500">{subtitle}</p>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3">
        <Link
          href={`/groceries?week=${weekParam(addDays(start, -7))}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-[#e7e5e4] bg-white px-4 text-base text-stone-700"
        >
          &larr; Previous week
        </Link>
        <Link
          href={`/groceries?week=${weekParam(addDays(start, 7))}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-[#e7e5e4] bg-white px-4 text-base text-stone-700"
        >
          Next week &rarr;
        </Link>
        <form action="/groceries" className="flex items-center gap-2">
          <label htmlFor="week" className="sr-only">
            Week containing
          </label>
          <input
            id="week"
            type="date"
            name="week"
            defaultValue={weekParam(start)}
            className="min-h-11 rounded-xl border border-[#e7e5e4] bg-white px-3 text-base text-stone-700"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xl px-4 text-base font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            Show
          </button>
        </form>
      </div>

      {list.cookDates.length > 0 && (
        <ul className="no-print overflow-hidden rounded-2xl border border-[#e7e5e4] bg-stone-50">
          {list.cookDates.map((cd) => (
            <li key={cd.id} className="border-t border-[#e7e5e4] bg-white first:border-t-0">
              <Link
                href={`/cook-dates/${cd.id}/groceries`}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-base"
              >
                <span className="text-stone-800">
                  {format(cd.scheduledFor, "EEE, MMM d")} · {cd.clientName}
                </span>
                <span className="shrink-0 text-sm text-stone-400">
                  {cd.hasMenu ? plural(cd.dishCount, "dish", "dishes") : "No final menu yet"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {withMenu.length === 0 ? (
        <div className="rounded-2xl border border-[#e7e5e4] bg-stone-50 px-5 py-8 text-center text-base text-stone-500">
          {list.cookDates.length === 0
            ? "No cook dates this week."
            : "Groceries appear once the menu is accepted."}
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
              mode="week"
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
