import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireKitchenApi } from "@/lib/guard";

export async function POST(request: NextRequest) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;

  const { clientId, date } = await request.json();

  if (!clientId || !date) {
    return NextResponse.json({ error: "Missing clientId or date" }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, kitchenId: kitchen.id },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Create cook date
  const cookDate = await prisma.cookDate.create({
    data: {
      kitchenId: kitchen.id,
      clientId,
      scheduledFor: new Date(`${date}T12:00:00`),
    },
  });

  // Create draft meal plan
  const proposal = await prisma.proposal.create({
    data: {
      kitchenId: kitchen.id,
      cookDateId: cookDate.id,
      title: `Menu for ${client.firstName} ${client.lastName}`,
    },
  });

  return NextResponse.json({
    cookDateId: cookDate.id,
    proposalId: proposal.id,
    proposalUrl: `/proposals/${proposal.id}`,
  });
}
