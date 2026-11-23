import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireKitchenApi } from "@/lib/guard";

export async function POST(request: NextRequest) {
  const { kitchen, error } = await requireKitchenApi();
  if (error) return error;

  const { menuCardId } = await request.json();
  if (!menuCardId) return NextResponse.json({ error: "Missing menuCardId" }, { status: 400 });

  try {
    const { count } = await prisma.menuCard.deleteMany({
      where: { id: menuCardId, kitchenId: kitchen.id },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Menu card not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
