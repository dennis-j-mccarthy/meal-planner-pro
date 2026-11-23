// "How did it taste?" — the short survey a client gets after a cook date.
// Beth sends it from the cook date steps; the client answers on the public
// /taste/<token> page; Beth gets an email with the answers and they show on
// the cook date.
//
// Deliberately NOT a "use server" module. Kitchen-side lookups are scoped to
// the kitchen passed in; the public side looks up by token only.
import { randomBytes } from "crypto";
import { format } from "date-fns";
import type { Kitchen } from "@/generated/prisma/client";
import { sendPlainEmail } from "@/lib/email";
import { chefSignoff, escapeHtml } from "@/lib/inbound-mail";
import { prisma } from "@/lib/prisma";
import { finalMenuForCookDate } from "@/lib/recipe-facts";

import { TASTE_RATINGS, TASTE_RATING_LABEL, type TasteRating } from "@/lib/taste-ratings";

export { TASTE_RATINGS, TASTE_RATING_LABEL, type TasteRating };

export type TasteDish = { recipeId: string; title: string; rating: TasteRating | null };

type KitchenRef = Pick<Kitchen, "id" | "name" | "contactEmail">;

const APP_URL = process.env.APP_URL || "https://meal-planner-pro-puce.vercel.app";

export function parseTasteDishes(json: string | null | undefined): TasteDish[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((d) => d && typeof d.recipeId === "string" && typeof d.title === "string")
      .map((d) => ({
        recipeId: d.recipeId,
        title: d.title,
        rating: (TASTE_RATINGS as readonly string[]).includes(d.rating) ? (d.rating as TasteRating) : null,
      }));
  } catch {
    return [];
  }
}

export function tasteUrl(token: string) {
  return `${APP_URL.replace(/\/$/, "")}/taste/${token}`;
}

export function stars(n: number | null | undefined) {
  if (!n) return "";
  return "★".repeat(n) + "☆".repeat(5 - n);
}

/** The dishes the client is asked about: what was actually cooked. */
export async function tasteDishesForCookDate(cookDateId: string, kitchenId: string) {
  const menu = await finalMenuForCookDate(cookDateId, kitchenId);
  return (menu?.dishes ?? []).map((d) => ({ recipeId: d.recipeId, title: d.title }));
}

function textToHtml(text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937;">${paras}</div>`;
}

export type TasteSendResult = { ok: true; to: string } | { ok: false; error: string };

/** Email the client their "How did it taste?" link (copied to the kitchen). */
export async function sendTasteEmail(cookDateId: string, kitchen: KitchenRef): Promise<TasteSendResult> {
  try {
    const cookDate = await prisma.cookDate.findFirst({
      where: { id: cookDateId, kitchenId: kitchen.id },
      include: { client: true, tasteFeedback: true },
    });
    if (!cookDate) return { ok: false, error: "Cook date not found" };

    const to = cookDate.client.email?.trim();
    if (!to) {
      return {
        ok: false,
        error: `${cookDate.client.firstName} ${cookDate.client.lastName} has no email address in the app`,
      };
    }
    const dishes = await tasteDishesForCookDate(cookDate.id, kitchen.id);
    if (dishes.length === 0) return { ok: false, error: "This cook date has no menu yet" };

    const feedback =
      cookDate.tasteFeedback ??
      (await prisma.tasteFeedback.create({
        data: {
          kitchenId: kitchen.id,
          clientId: cookDate.clientId,
          cookDateId: cookDate.id,
          token: randomBytes(18).toString("base64url"),
        },
      }));

    const day = format(cookDate.scheduledFor, "EEEE, MMMM d");
    const text = [
      `Hi ${cookDate.client.firstName},`,
      ``,
      `I hope you enjoyed your meals from ${day}. How did everything taste? It takes about a minute:`,
      ``,
      tasteUrl(feedback.token),
      ``,
      `Your answers help me plan your next menu.`,
      ``,
      chefSignoff(kitchen),
    ].join("\n");

    const own = kitchen.contactEmail?.trim() || null;
    await sendPlainEmail({
      to,
      ...(own && own.toLowerCase() !== to.toLowerCase() ? { cc: own } : {}),
      ...(own ? { replyTo: own } : {}),
      subject: "How did everything taste?",
      text,
      html: textToHtml(text),
    });

    await prisma.tasteFeedback.update({ where: { id: feedback.id }, data: { sentAt: new Date() } });
    return { ok: true, to };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Tell the kitchen the client answered. Never throws. */
export async function notifyKitchenOfTaste(feedbackId: string) {
  try {
    const fb = await prisma.tasteFeedback.findUnique({
      where: { id: feedbackId },
      include: { kitchen: true, client: true, cookDate: true },
    });
    const to = fb?.kitchen.contactEmail?.trim();
    if (!fb || !to) return;

    const name = `${fb.client.firstName} ${fb.client.lastName}`.trim();
    const dishes = parseTasteDishes(fb.dishes);
    const text = [
      `${name} answered "How did everything taste?" for ${format(fb.cookDate.scheduledFor, "EEEE, MMMM d")}.`,
      ``,
      `Overall: ${fb.overall ? `${stars(fb.overall)} (${fb.overall} of 5)` : "(not answered)"}`,
      ``,
      ...dishes.map((d) => `${d.title}: ${d.rating ? TASTE_RATING_LABEL[d.rating] : "(not answered)"}`),
      ``,
      fb.comment ? `Comment:\n${fb.comment}` : "Comment: (none)",
      ``,
      `Open the cook date: ${APP_URL.replace(/\/$/, "")}/cook-dates/${fb.cookDateId}`,
    ].join("\n");

    await sendPlainEmail({
      to,
      subject: `${name}: How did everything taste?${fb.overall ? ` ${stars(fb.overall)}` : ""}`,
      text,
    });
  } catch {
    // The client's answers are saved either way.
  }
}
