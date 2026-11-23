// Auth + tenancy guards. Deliberately NOT a "use server" module: every export
// of a "use server" file becomes a publicly callable action.
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Kitchen } from "@/generated/prisma/client";
import { getKitchen } from "@/lib/data";

/**
 * Returns the signed-in user's active kitchen (honouring the admin
 * kitchen-switch cookie). Anonymous callers are sent to "/", which shows the
 * marketing page with the Sign in button. For pages and server actions.
 */
export async function requireKitchen(): Promise<Kitchen> {
  const kitchen = await getKitchen();
  if (!kitchen) redirect("/");
  return kitchen;
}

type ApiKitchen =
  | { kitchen: Kitchen; error: null }
  | { kitchen: null; error: NextResponse };

/**
 * Route-handler variant: returns a 401 JSON response instead of redirecting,
 * so fetch() callers get an error they can read.
 *
 *   const { kitchen, error } = await requireKitchenApi();
 *   if (error) return error;
 */
export async function requireKitchenApi(): Promise<ApiKitchen> {
  const kitchen = await getKitchen();
  if (!kitchen) {
    return {
      kitchen: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { kitchen, error: null };
}
