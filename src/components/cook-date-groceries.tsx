import { format } from "date-fns";
import { GroceryChecklist } from "@/components/grocery-checklist";
import { buildGroceryList, toChecklist } from "@/lib/grocery";

// The grocery checklist inside the cook date's Groceries step. Async: the page
// streams around it (wrap in <Suspense>), since missing ingredients are
// filled by AI the first time a menu's list is built.
export async function CookDateGroceries({ cookDateId, kitchenId }: { cookDateId: string; kitchenId: string }) {
  const list = await buildGroceryList(cookDateId, kitchenId);
  const cd = list?.cookDates[0];
  if (!list || !cd || !cd.hasMenu) return null;

  const title = `Groceries · ${format(cd.scheduledFor, "EEEE, MMMM d")}`;
  const subtitle = [cd.clientName, `${cd.dishCount} ${cd.dishCount === 1 ? "dish" : "dishes"}`]
    .concat(cd.guests ? [`${cd.guests} ${cd.guests === 1 ? "guest" : "guests"}`] : [])
    .join(" · ");
  const { groups, copyText } = toChecklist(list, "cookDate", `${title}\n${subtitle}`);

  return (
    <div className="space-y-4">
      {list.missing.length > 0 && (
        <p className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm muted">
          No ingredients yet for {list.missing.join(", ")}. Reload in a minute to try again.
        </p>
      )}
      {groups.length > 0 ? (
        <GroceryChecklist
          mode="cookDate"
          cookDateId={cookDateId}
          groups={groups}
          initialChecked={list.checked}
          copyText={copyText}
        />
      ) : (
        list.missing.length === 0 && <p className="text-sm muted">No ingredients on these recipes yet.</p>
      )}
    </div>
  );
}

export function CookDateGroceriesLoading() {
  return (
    <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm muted">
      Building the grocery list…
    </p>
  );
}
