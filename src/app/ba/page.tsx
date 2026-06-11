import { BaWizard } from "@/components/ba-wizard";
import { getKitchen } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Quick Bon Appetit",
};

export default async function BaPage() {
  const kitchen = await getKitchen();
  const clients = await prisma.client.findMany({
    where: { kitchenId: kitchen.id },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <BaWizard
      clients={clients.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
      }))}
    />
  );
}
