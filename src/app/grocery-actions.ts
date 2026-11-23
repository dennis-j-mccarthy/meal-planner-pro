"use server";

// Grocery check-offs, stored per cook date in CookDate.groceryChecked (a JSON
// array of item keys from recipe-facts-format.ts itemKey()). Every export of
// this file is a publicly callable action: each one starts with
// requireKitchen() and only touches cook dates in that kitchen.
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { parseCheckedKeys } from "@/lib/recipe-facts-format";

const MAX_KEY_LENGTH = 120;
const MAX_KEYS = 2000;
const MAX_COOK_DATES = 40;

function validKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= MAX_KEY_LENGTH && /^[a-z0-9-]+$/.test(key);
}

function withKey(current: string[], key: string, checked: boolean): string[] {
  const set = new Set(current);
  if (checked) set.add(key);
  else set.delete(key);
  return [...set].slice(-MAX_KEYS);
}

// No revalidatePath here on purpose: the checklist updates optimistically,
// and a re-render would rebuild the list (and retry any missing AI facts) on
// every tap. The grocery pages are dynamic, so the next visit reads fresh.

/** Flip one item on one cook date's list. Returns the item's new state. */
export async function toggleGroceryItem(cookDateId: string, key: string): Promise<{ checked: boolean }> {
  const kitchen = await requireKitchen();
  if (typeof cookDateId !== "string" || !validKey(key)) throw new Error("Invalid item");

  const cd = await prisma.cookDate.findFirst({
    where: { id: cookDateId, kitchenId: kitchen.id },
    select: { id: true, groceryChecked: true },
  });
  if (!cd) throw new Error("Cook date not found");

  const current = parseCheckedKeys(cd.groceryChecked);
  const checked = !current.includes(key);
  await prisma.cookDate.updateMany({
    where: { id: cd.id, kitchenId: kitchen.id },
    data: { groceryChecked: JSON.stringify(withKey(current, key, checked)) },
  });

  return { checked };
}

/**
 * Set one item checked/unchecked on several cook dates at once (the weekly
 * list). Sets rather than toggles, so the cook dates can't drift apart.
 */
export async function setGroceryItemChecked(
  cookDateIds: string[],
  key: string,
  checked: boolean,
): Promise<{ checked: boolean }> {
  const kitchen = await requireKitchen();
  if (!Array.isArray(cookDateIds) || !validKey(key) || typeof checked !== "boolean") {
    throw new Error("Invalid item");
  }
  const ids = [...new Set(cookDateIds.filter((id) => typeof id === "string"))].slice(0, MAX_COOK_DATES);
  if (ids.length === 0) return { checked };

  const rows = await prisma.cookDate.findMany({
    where: { id: { in: ids }, kitchenId: kitchen.id },
    select: { id: true, groceryChecked: true },
  });

  for (const cd of rows) {
    await prisma.cookDate.updateMany({
      where: { id: cd.id, kitchenId: kitchen.id },
      data: {
        groceryChecked: JSON.stringify(withKey(parseCheckedKeys(cd.groceryChecked), key, checked)),
      },
    });
  }

  return { checked };
}
