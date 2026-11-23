"use server";

// Every export of this file is a publicly callable action.
//  - submitTasteFeedback is the client's answer on the public /taste page:
//    it is looked up by token only and touches nothing else.
//  - The rest are Beth's buttons on the cook date steps: each starts with
//    requireKitchen() and only touches cook dates in that kitchen.
import { revalidatePath } from "next/cache";
import { requireKitchen } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import {
  notifyKitchenOfTaste,
  sendTasteEmail,
  TASTE_RATINGS,
  tasteDishesForCookDate,
  type TasteRating,
  type TasteSendResult,
} from "@/lib/taste";

const MAX_COMMENT = 4000;

export async function submitTasteFeedback(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = String(formData.get("token") ?? "");
  if (!token || token.length > 64) return { ok: false, error: "This link is no longer active." };

  const feedback = await prisma.tasteFeedback.findUnique({ where: { token } });
  if (!feedback) return { ok: false, error: "This link is no longer active." };

  const overallRaw = Number(formData.get("overall"));
  const overall = Number.isInteger(overallRaw) && overallRaw >= 1 && overallRaw <= 5 ? overallRaw : null;
  const comment = String(formData.get("comment") ?? "").trim().slice(0, MAX_COMMENT) || null;

  // Only the dishes on this cook date's menu; titles come from the database.
  const menu = await tasteDishesForCookDate(feedback.cookDateId, feedback.kitchenId);
  const dishes = menu.map((d) => {
    const r = String(formData.get(`dish_${d.recipeId}`) ?? "");
    const rating = (TASTE_RATINGS as readonly string[]).includes(r) ? (r as TasteRating) : null;
    return { recipeId: d.recipeId, title: d.title, rating };
  });

  if (!overall && !comment && dishes.every((d) => !d.rating)) {
    return { ok: false, error: "Pick a few answers first." };
  }

  await prisma.tasteFeedback.update({
    where: { id: feedback.id },
    data: { overall, comment, dishes: JSON.stringify(dishes), submittedAt: new Date() },
  });
  await notifyKitchenOfTaste(feedback.id);
  revalidatePath(`/cook-dates/${feedback.cookDateId}`);
  return { ok: true };
}

export async function sendTasteEmailAction(formData: FormData): Promise<TasteSendResult> {
  const kitchen = await requireKitchen();
  const cookDateId = String(formData.get("cookDateId") ?? "");
  const res = await sendTasteEmail(cookDateId, kitchen);
  if (res.ok) revalidatePath(`/cook-dates/${cookDateId}`);
  return res;
}

/** "Groceries bought" (done = true) or undo it. */
export async function setGroceriesDone(cookDateId: string, done: boolean) {
  const kitchen = await requireKitchen();
  await prisma.cookDate.updateMany({
    where: { id: cookDateId, kitchenId: kitchen.id },
    data: { groceriesDoneAt: done ? new Date() : null },
  });
  revalidatePath(`/cook-dates/${cookDateId}`);
}
