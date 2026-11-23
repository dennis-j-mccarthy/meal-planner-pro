// Find a client's cook date on a given calendar day (US Eastern), or create
// one. Used by the inbound-email paths, which have no signed-in user, so the
// kitchen is passed explicitly and every query is scoped to it.
import type { CookDateStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { easternDayKey } from "@/lib/inbound-mail";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function findOrCreateCookDate(opts: {
  kitchenId: string;
  clientId: string;
  date: Date;
  // Status for a newly created cook date; an existing one is left as is.
  status: CookDateStatus;
}): Promise<{ id: string; created: boolean }> {
  const key = easternDayKey(opts.date);
  const nearby = await prisma.cookDate.findMany({
    where: {
      kitchenId: opts.kitchenId,
      clientId: opts.clientId,
      status: { not: "CANCELLED" },
      scheduledFor: {
        gte: new Date(opts.date.getTime() - DAY_MS),
        lte: new Date(opts.date.getTime() + DAY_MS),
      },
    },
    select: { id: true, scheduledFor: true },
    orderBy: { createdAt: "asc" },
  });
  const existing = nearby.find((cd) => easternDayKey(cd.scheduledFor) === key);
  if (existing) return { id: existing.id, created: false };

  const cookDate = await prisma.cookDate.create({
    data: {
      kitchenId: opts.kitchenId,
      clientId: opts.clientId,
      scheduledFor: opts.date,
      status: opts.status,
    },
    select: { id: true },
  });
  return { id: cookDate.id, created: true };
}
