import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Returns the active kitchen based on a cookie.
 * When Clerk is added, this will resolve from the authenticated user instead.
 */
export async function getKitchen() {
  const cookieStore = await cookies();
  const kitchenId = cookieStore.get("kitchen_id")?.value;

  if (kitchenId) {
    const kitchen = await prisma.kitchen.findUnique({
      where: { id: kitchenId },
    });
    if (kitchen) return kitchen;
  }

  // Fallback: return first kitchen
  const fallback = await prisma.kitchen.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (fallback) return fallback;

  // Last resort: create a default
  return prisma.kitchen.create({
    data: {
      name: "Founder's Table",
      city: "Charlotte",
      state: "NC",
      serviceArea: "Demo workspace",
    },
  });
}

/**
 * Returns all kitchens for the switcher UI.
 */
export async function getAllKitchens() {
  return prisma.kitchen.findMany({
    orderBy: { name: "asc" },
  });
}
