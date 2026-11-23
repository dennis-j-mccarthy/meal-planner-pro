import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireKitchenApi } from "@/lib/guard";

export async function POST(request: NextRequest) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;

  const { cookDateId } = await request.json();

  if (!cookDateId) {
    return NextResponse.json({ error: "Missing cookDateId" }, { status: 400 });
  }

  try {
    // Clear finalizedProposalId first to break circular FK
    const { count } = await prisma.cookDate.updateMany({
      where: { id: cookDateId, kitchenId: kitchen.id },
      data: { finalizedProposalId: null },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Cook date not found" }, { status: 404 });
    }

    await prisma.cookDate.deleteMany({
      where: { id: cookDateId, kitchenId: kitchen.id },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
