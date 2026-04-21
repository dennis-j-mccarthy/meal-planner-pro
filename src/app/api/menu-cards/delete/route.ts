import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { menuCardId } = await request.json();
  if (!menuCardId) return NextResponse.json({ error: "Missing menuCardId" }, { status: 400 });

  try {
    await prisma.menuCard.delete({ where: { id: menuCardId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
