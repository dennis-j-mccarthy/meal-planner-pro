import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const JWB_EMAILS = new Set([
  "dennisjmccarthy@gmail.com",
  "marketing@avemaria.edu",
  "yogabeth@mac.com",
]);

/**
 * Resolves or creates a User record for the authenticated Clerk user.
 * On first signup:
 *   - If the user's email is in JWB_EMAILS, they claim the existing JWB kitchen as admin.
 *   - Otherwise, a fresh empty kitchen is created for them.
 */
async function resolveUserAndKitchen() {
  const { userId } = await auth();
  if (!userId) return null;

  // Already mapped?
  const existing = await prisma.user.findUnique({
    where: { clerkUserId: userId },
    include: { kitchen: true },
  });
  if (existing) return existing;

  // First login — look up Clerk profile for email
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || null;

  let kitchenId: string;
  let isAdmin = false;

  if (email && JWB_EMAILS.has(email)) {
    // Claim the JWB kitchen
    const jwb = await prisma.kitchen.findUnique({
      where: { id: "kitchen_jwb" },
    });
    if (jwb) {
      kitchenId = jwb.id;
      isAdmin = true;
    } else {
      // JWB kitchen somehow missing — create a personal kitchen
      const newKitchen = await prisma.kitchen.create({
        data: {
          name: "Joyful Wellness with Beth",
          city: "Naples",
          state: "FL",
        },
      });
      kitchenId = newKitchen.id;
      isAdmin = true;
    }
  } else {
    // New user — give them a fresh kitchen
    const firstName = clerkUser?.firstName || "My";
    const newKitchen = await prisma.kitchen.create({
      data: {
        name: `${firstName}'s Kitchen`,
      },
    });
    kitchenId = newKitchen.id;
  }

  const user = await prisma.user.create({
    data: {
      clerkUserId: userId,
      email,
      kitchenId,
      isAdmin,
    },
    include: { kitchen: true },
  });

  return user;
}

/**
 * Returns the active kitchen for the authenticated user.
 * Falls back to first kitchen only if not logged in (for pages that tolerate anonymous browsing).
 */
export async function getKitchen() {
  const user = await resolveUserAndKitchen();

  if (user) {
    // Admins can override via cookie to switch between kitchens
    if (user.isAdmin) {
      const cookieStore = await cookies();
      const override = cookieStore.get("kitchen_id")?.value;
      if (override) {
        const k = await prisma.kitchen.findUnique({ where: { id: override } });
        if (k) return k;
      }
    }
    return user.kitchen;
  }

  // Not logged in — return demo kitchen for marketing/preview purposes
  const demo = await prisma.kitchen.findFirst({
    where: { id: "kitchen_demo" },
  });
  if (demo) return demo;

  // Last resort
  const fallback = await prisma.kitchen.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (fallback) return fallback;

  return prisma.kitchen.create({
    data: { name: "Demo Kitchen" },
  });
}

/**
 * Returns kitchens the user can switch between — only populated for admins.
 */
export async function getAllKitchens() {
  const user = await resolveUserAndKitchen();
  if (user?.isAdmin) {
    return prisma.kitchen.findMany({ orderBy: { name: "asc" } });
  }
  if (user) {
    return [user.kitchen];
  }
  return [];
}

/**
 * Returns true if the current user is an admin for their kitchen.
 */
export async function isAdmin(): Promise<boolean> {
  const user = await resolveUserAndKitchen();
  return user?.isAdmin ?? false;
}
